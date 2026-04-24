package com.willitcocktail.litertlm

import android.content.ContentResolver
import android.content.Context
import android.net.Uri
import android.util.Log
import com.google.ai.edge.litertlm.Backend
import com.google.ai.edge.litertlm.Content
import com.google.ai.edge.litertlm.Engine
import com.google.ai.edge.litertlm.EngineConfig
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicReference

/**
 * Thin wrapper around the LiteRT-LM [Engine] API (litertlm-android:0.10.2).
 * Supports the newer .litertlm model format used by AI Edge Gallery.
 *
 * One engine per process; reloaded if the model file changes.
 * All inference runs on a single-thread executor — Engine is not thread-safe.
 */
class LiteRtEngine(private val appContext: Context) {
    private val tag = "LiteRtEngine"
    private val executor = Executors.newSingleThreadExecutor { r ->
        Thread(r, "litert-lm-worker").apply { isDaemon = true }
    }
    private val engineRef = AtomicReference<Engine?>(null)
    @Volatile private var configuredUrl: String? = null
    @Volatile private var expectedSha256: String? = null
    // Tracks which backend was selected at engine init time.
    @Volatile private var activeBackend: String? = null
    // Set to false after a GPU inference failure so subsequent getOrCreate()
    // calls skip GPU and go straight to CPU.
    @Volatile private var allowGpu = true

    data class Status(
        val downloaded: Boolean,
        val ready: Boolean,
        val path: String?,
        val sizeBytes: Long?,
        val backend: String?,    // "gpu" | "cpu" | null when not yet initialised
    )

    data class GenerateOutput(
        val text: String,
        val tokenCount: Int?,
        val stopReason: String,
    )

    // --- Model file management ------------------------------------------

    // When configuredUrl is a file:// path (dev sideload), use it if accessible.
    // Fall back to the internal default so ROM-level FUSE restrictions don't
    // silently break the engine when the external path is blocked.
    private fun resolvedModelFile(): File {
        val url = configuredUrl
        if (url != null && url.startsWith("file://")) {
            val f = File(url.removePrefix("file://"))
            if (f.exists()) return f
        }
        return File(appContext.filesDir, "llm/model.litertlm")
    }

    fun setConfig(url: String, expectedSha256: String?) {
        val changed = url != configuredUrl
        configuredUrl = url
        this.expectedSha256 = expectedSha256
        if (changed) {
            engineRef.getAndSet(null)?.close()
        }
    }

    fun status(): Status {
        val f = resolvedModelFile()
        val downloaded = f.exists() && f.length() > 0
        val ready = downloaded && engineRef.get() != null
        return Status(
            downloaded = downloaded,
            ready = ready,
            path = if (downloaded) f.absolutePath else null,
            sizeBytes = if (downloaded) f.length() else null,
            backend = if (ready) activeBackend else null,
        )
    }

    fun deleteModel() {
        engineRef.getAndSet(null)?.close()
        val url = configuredUrl
        if (url == null || !url.startsWith("file://")) {
            val f = resolvedModelFile()
            if (f.exists()) f.delete()
        }
    }

    // --- Download --------------------------------------------------------

    fun downloadAsync(
        onProgress: (Long, Long) -> Unit,
        onComplete: (Result<String>) -> Unit,
    ) {
        val url = configuredUrl
        if (url.isNullOrBlank()) {
            onComplete(Result.failure(IllegalStateException("no model URL configured — call setModelConfig first")))
            return
        }
        executor.execute {
            try {
                val dest = resolvedModelFile()
                dest.parentFile?.mkdirs()
                val tmp = File(dest.parentFile, "model.litertlm.part")
                val conn = (URL(url).openConnection() as HttpURLConnection).apply {
                    requestMethod = "GET"
                    connectTimeout = 15_000
                    readTimeout = 30_000
                }
                val code = conn.responseCode
                if (code !in 200..299) {
                    conn.disconnect()
                    onComplete(Result.failure(RuntimeException("download HTTP $code")))
                    return@execute
                }
                val total = conn.contentLengthLong
                conn.inputStream.use { input ->
                    FileOutputStream(tmp).use { out ->
                        val buf = ByteArray(64 * 1024)
                        var downloaded = 0L
                        var lastReport = 0L
                        while (true) {
                            val n = input.read(buf)
                            if (n < 0) break
                            out.write(buf, 0, n)
                            downloaded += n
                            if (downloaded - lastReport > 256 * 1024) {
                                onProgress(downloaded, total)
                                lastReport = downloaded
                            }
                        }
                        onProgress(downloaded, total)
                    }
                }
                conn.disconnect()

                expectedSha256?.let { expected ->
                    val actual = sha256Hex(tmp)
                    if (!actual.equals(expected, ignoreCase = true)) {
                        tmp.delete()
                        onComplete(
                            Result.failure(
                                RuntimeException("sha256 mismatch: got ${actual.take(12)}… expected ${expected.take(12)}…"),
                            ),
                        )
                        return@execute
                    }
                }

                if (dest.exists()) dest.delete()
                if (!tmp.renameTo(dest)) {
                    throw RuntimeException("could not rename downloaded model")
                }
                engineRef.getAndSet(null)?.close()
                onComplete(Result.success(dest.absolutePath))
            } catch (t: Throwable) {
                Log.e(tag, "download failed", t)
                onComplete(Result.failure(t))
            }
        }
    }

    // --- Import from content URI (file picker) ---------------------------

    fun importFromUri(
        resolver: ContentResolver,
        uri: Uri,
        onProgress: (Long, Long) -> Unit,
        onComplete: (Result<String>) -> Unit,
    ) {
        executor.execute {
            try {
                // Always import to the default internal path regardless of configuredUrl.
                val dest = File(appContext.filesDir, "llm/model.litertlm")
                dest.parentFile?.mkdirs()
                val tmp = File(dest.parentFile, "model.litertlm.part")

                val total = resolver.openFileDescriptor(uri, "r")
                    ?.use { it.statSize } ?: -1L

                resolver.openInputStream(uri)?.use { input ->
                    FileOutputStream(tmp).use { out ->
                        val buf = ByteArray(64 * 1024)
                        var written = 0L
                        var lastReport = 0L
                        while (true) {
                            val n = input.read(buf)
                            if (n < 0) break
                            out.write(buf, 0, n)
                            written += n
                            if (written - lastReport > 256 * 1024) {
                                onProgress(written, total)
                                lastReport = written
                            }
                        }
                        onProgress(written, total)
                    }
                } ?: throw IOException("cannot open input stream for URI")

                engineRef.getAndSet(null)?.close()
                if (dest.exists()) dest.delete()
                if (!tmp.renameTo(dest)) throw RuntimeException("cannot rename imported model")
                onComplete(Result.success(dest.absolutePath))
            } catch (t: Throwable) {
                Log.e(tag, "import failed", t)
                onComplete(Result.failure(t))
            }
        }
    }

    fun importFromPath(
        src: File,
        onProgress: (Long, Long) -> Unit,
        onComplete: (Result<String>) -> Unit,
    ) {
        executor.execute {
            try {
                if (!src.exists()) throw IllegalArgumentException("file not found: ${src.absolutePath}")
                val dest = File(appContext.filesDir, "llm/model.litertlm")
                dest.parentFile?.mkdirs()
                val tmp = File(dest.parentFile, "model.litertlm.part")
                val total = src.length()
                src.inputStream().use { input ->
                    FileOutputStream(tmp).use { out ->
                        val buf = ByteArray(64 * 1024)
                        var written = 0L
                        var lastReport = 0L
                        while (true) {
                            val n = input.read(buf)
                            if (n < 0) break
                            out.write(buf, 0, n)
                            written += n
                            if (written - lastReport > 256 * 1024) {
                                onProgress(written, total)
                                lastReport = written
                            }
                        }
                        onProgress(written, total)
                    }
                }
                engineRef.getAndSet(null)?.close()
                if (dest.exists()) dest.delete()
                if (!tmp.renameTo(dest)) throw RuntimeException("cannot rename imported model")
                onComplete(Result.success(dest.absolutePath))
            } catch (t: Throwable) {
                Log.e(tag, "importFromPath failed", t)
                onComplete(Result.failure(t))
            }
        }
    }

    // --- Inference -------------------------------------------------------

    fun generateAsync(
        prompt: String,
        maxTokens: Int,
        temperature: Float,
        topK: Int,
        onComplete: (Result<GenerateOutput>) -> Unit,
    ) {
        executor.execute {
            try {
                val eng = getOrCreate(maxTokens)
                try {
                    onComplete(Result.success(runInference(eng, prompt)))
                } catch (inferErr: Throwable) {
                    // GPU can initialise successfully but fail at inference time
                    // (OOM, unsupported op, driver crash). Demote to CPU and retry.
                    if (activeBackend == "gpu") {
                        Log.w(tag, "GPU inference failed (${inferErr.message}) — demoting to CPU")
                        engineRef.getAndSet(null)?.close()
                        activeBackend = null
                        allowGpu = false
                        val cpuEng = getOrCreate(maxTokens)
                        onComplete(Result.success(runInference(cpuEng, prompt)))
                    } else {
                        throw inferErr
                    }
                }
            } catch (t: Throwable) {
                Log.e(tag, "generate failed", t)
                onComplete(Result.failure(t))
            }
        }
    }

    private fun runInference(eng: Engine, prompt: String): GenerateOutput {
        val conversation = eng.createConversation()
        try {
            val message = conversation.sendMessage(prompt)
            val text = message.contents.contents
                .filterIsInstance<Content.Text>()
                .joinToString("") { it.text }
            return GenerateOutput(text, null, "stop")
        } finally {
            conversation.close()
        }
    }

    private fun getOrCreate(maxTokens: Int): Engine {
        engineRef.get()?.let { return it }
        val f = resolvedModelFile()
        if (!f.exists()) {
            throw IllegalStateException("model not downloaded — call downloadModel first")
        }
        // Try GPU first (2-3× throughput vs CPU on Adreno/Mali/PowerVR).
        // Skip GPU if a previous inference failure already demoted us.
        val backends = if (allowGpu) {
            listOf(Backend.GPU() to "gpu", Backend.CPU() to "cpu")
        } else {
            listOf(Backend.CPU() to "cpu")
        }
        for ((backend, label) in backends) {
            try {
                val config = EngineConfig(
                    modelPath = f.absolutePath,
                    backend = backend,
                    maxNumTokens = maxTokens.coerceAtLeast(256),
                    cacheDir = appContext.cacheDir.absolutePath,
                )
                val eng = Engine(config)
                eng.initialize()
                engineRef.set(eng)
                activeBackend = label
                Log.i(tag, "Engine initialised on $label backend")
                return eng
            } catch (t: Throwable) {
                Log.w(tag, "$label backend failed: ${t.message} — trying next")
            }
        }
        throw RuntimeException("All backends failed for model at ${f.absolutePath}")
    }

    // --- Cleanup ---------------------------------------------------------

    fun close() {
        engineRef.getAndSet(null)?.close()
        executor.shutdown()
    }

    private fun sha256Hex(file: File): String {
        val md = MessageDigest.getInstance("SHA-256")
        file.inputStream().use { input ->
            val buf = ByteArray(64 * 1024)
            while (true) {
                val n = input.read(buf)
                if (n < 0) break
                md.update(buf, 0, n)
            }
        }
        return md.digest().joinToString("") { "%02x".format(it) }
    }
}
