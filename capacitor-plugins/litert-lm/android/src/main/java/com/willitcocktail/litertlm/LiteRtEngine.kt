package com.willitcocktail.litertlm

import android.content.Context
import android.util.Log
import com.google.mediapipe.tasks.genai.llminference.LlmInference
import com.google.mediapipe.tasks.genai.llminference.LlmInferenceSession
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicReference
import org.json.JSONObject

/**
 * Thin wrapper around MediaPipe GenAI's [LlmInference]. One engine per
 * process; reloaded if the model file changes.
 *
 * The Maven coord for the inference library is intentionally **not** checked
 * in here — see `capacitor-plugins/litert-lm/README.md` for the current coord
 * and any API-shape notes. If Google renames the package from
 * `com.google.mediapipe.tasks.genai.llminference` to something else (LiteRT-LM
 * and MediaPipe GenAI have been converging under the "LiteRT-LM" umbrella),
 * swap the two imports above and the class names; the public methods on
 * [LlmInference] have been stable at `createFromOptions`, `generateResponse`,
 * and `close` across recent versions.
 */
class LiteRtEngine(private val appContext: Context) {
    private val tag = "LiteRtEngine"
    private val executor = Executors.newSingleThreadExecutor { r ->
        Thread(r, "litert-lm-worker").apply { isDaemon = true }
    }
    private val inference = AtomicReference<LlmInference?>(null)
    @Volatile private var configuredUrl: String? = null
    @Volatile private var expectedSha256: String? = null

    data class Status(
        val downloaded: Boolean,
        val ready: Boolean,
        val path: String?,
        val sizeBytes: Long?,
    )

    data class GenerateOutput(
        val text: String,
        val tokenCount: Int?,
        val stopReason: String, // "stop" | "length" | "error"
    )

    // --- Model file management ------------------------------------------

    private fun modelFile(): File = File(appContext.filesDir, "llm/gemma.task")

    fun setConfig(url: String, expectedSha256: String?) {
        val changed = url != configuredUrl
        configuredUrl = url
        this.expectedSha256 = expectedSha256
        // A config change invalidates any loaded engine — reloading happens
        // lazily on the next generate() call.
        if (changed) {
            inference.getAndSet(null)?.close()
        }
    }

    fun status(): Status {
        val f = modelFile()
        val downloaded = f.exists() && f.length() > 0
        val ready = downloaded && inference.get() != null
        return Status(
            downloaded = downloaded,
            ready = ready,
            path = if (downloaded) f.absolutePath else null,
            sizeBytes = if (downloaded) f.length() else null,
        )
    }

    fun deleteModel() {
        inference.getAndSet(null)?.close()
        val f = modelFile()
        if (f.exists()) f.delete()
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
                val dest = modelFile()
                dest.parentFile?.mkdirs()
                val tmp = File(dest.parentFile, "gemma.task.part")
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
                            // Throttle progress events to once per ~256KB.
                            if (downloaded - lastReport > 256 * 1024) {
                                onProgress(downloaded, total)
                                lastReport = downloaded
                            }
                        }
                        onProgress(downloaded, total)
                    }
                }
                conn.disconnect()

                // Verify sha256 if requested. Partial file stays in .part so
                // a bad download doesn't wipe a previously good model.
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
                // Drop any previously loaded engine — it was pinning the old file.
                inference.getAndSet(null)?.close()
                onComplete(Result.success(dest.absolutePath))
            } catch (t: Throwable) {
                Log.e(tag, "download failed", t)
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
        jsonSchema: JSONObject?,
        onComplete: (Result<GenerateOutput>) -> Unit,
    ) {
        executor.execute {
            try {
                val engine = getOrCreate(maxTokens)
                val text = runInference(engine, prompt, temperature, topK, jsonSchema)
                // MediaPipe doesn't expose a token count on the sync API;
                // leave it null and let the TS side ignore.
                onComplete(Result.success(GenerateOutput(text, null, "stop")))
            } catch (t: Throwable) {
                Log.e(tag, "generate failed", t)
                onComplete(Result.failure(t))
            }
        }
    }

    private fun getOrCreate(maxTokens: Int): LlmInference {
        inference.get()?.let { return it }
        val f = modelFile()
        if (!f.exists()) {
            throw IllegalStateException("model not downloaded — call downloadModel first")
        }
        val options = LlmInference.LlmInferenceOptions.builder()
            .setModelPath(f.absolutePath)
            .setMaxTokens(maxTokens.coerceAtLeast(256))
            .build()
        val engine = LlmInference.createFromOptions(appContext, options)
        inference.set(engine)
        return engine
    }

    private fun runInference(
        engine: LlmInference,
        prompt: String,
        temperature: Float,
        topK: Int,
        jsonSchema: JSONObject?,
    ): String {
        // Prefer the session API when available (per-call temperature/topK).
        // Fall back to the simple generateResponse if the session factory
        // isn't present in the deployed MediaPipe version.
        return try {
            val sessionOpts = LlmInferenceSession.LlmInferenceSessionOptions.builder()
                .setTemperature(temperature)
                .setTopK(topK)
                .also { builder ->
                    if (jsonSchema != null) {
                        // Constrained decoding support is opt-in per build;
                        // reflectively wire it so older SDKs still compile.
                        try {
                            val m = builder.javaClass.getMethod("setJsonSchema", String::class.java)
                            m.invoke(builder, jsonSchema.toString())
                        } catch (_: NoSuchMethodException) {
                            // Not supported — prompt carries the shape.
                        }
                    }
                }
                .build()
            LlmInferenceSession.createFromOptions(engine, sessionOpts).use { session ->
                session.addQueryChunk(prompt)
                session.generateResponse()
            }
        } catch (_: NoSuchMethodError) {
            engine.generateResponse(prompt)
        }
    }

    // --- Cleanup ---------------------------------------------------------

    fun close() {
        inference.getAndSet(null)?.close()
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
