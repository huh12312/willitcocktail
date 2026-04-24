package com.willitcocktail.litertlm

import android.Manifest
import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.Settings
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONArray
import java.io.File

@CapacitorPlugin(
    name = "LiteRtLm",
    permissions = [Permission(alias = "network", strings = [Manifest.permission.INTERNET])],
)
class LiteRtLmPlugin : Plugin() {
    private val engine: LiteRtEngine by lazy { LiteRtEngine(context) }
    private val aiCore: AiCoreEngine by lazy { AiCoreEngine() }
    // Scope for ML Kit suspend calls. SupervisorJob so one failing call
    // doesn't cancel siblings.
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    // Kept outside savedCall/freeSavedCall to avoid Capacitor clearing it
    // before we read it in handleOnActivityResult.
    private var importCall: PluginCall? = null

    companion object {
        private const val REQUEST_IMPORT = 9001
    }

    @PluginMethod
    fun modelStatus(call: PluginCall) {
        val status = engine.status()
        val out = JSObject().apply {
            put("downloaded", status.downloaded)
            put("ready", status.ready)
            status.path?.let { put("path", it) }
            status.sizeBytes?.let { put("sizeBytes", it) }
            status.backend?.let { put("backend", it) }
        }
        call.resolve(out)
    }

    @PluginMethod
    fun setModelConfig(call: PluginCall) {
        val url = call.getString("url")
        if (url.isNullOrBlank()) {
            call.reject("url is required")
            return
        }
        val expected = call.getString("expectedSha256")
        engine.setConfig(url = url, expectedSha256 = expected)
        call.resolve()
    }

    @PluginMethod
    fun downloadModel(call: PluginCall) {
        engine.downloadAsync(
            onProgress = { bytes, total ->
                notifyListeners("downloadProgress", JSObject().apply {
                    put("bytesDownloaded", bytes)
                    put("totalBytes", total)
                })
            },
            onComplete = { result ->
                result.onSuccess { path ->
                    call.resolve(JSObject().apply { put("path", path) })
                }
                result.onFailure { err ->
                    call.reject(err.message ?: "download failed", Exception(err))
                }
            },
        )
    }

    @PluginMethod
    fun deleteModel(call: PluginCall) {
        try {
            engine.deleteModel()
            call.resolve()
        } catch (t: Throwable) {
            call.reject(t.message ?: "delete failed", Exception(t))
        }
    }

    @PluginMethod
    fun generate(call: PluginCall) {
        val prompt = call.getString("prompt")
        if (prompt.isNullOrBlank()) {
            call.reject("prompt is required")
            return
        }
        engine.generateAsync(
            prompt = prompt,
            maxTokens = call.getInt("maxTokens") ?: 512,
            temperature = call.getFloat("temperature") ?: 0.3f,
            topK = call.getInt("topK") ?: 40,
            onComplete = { result ->
                result.onSuccess { output ->
                    call.resolve(JSObject().apply {
                        put("text", output.text)
                        output.tokenCount?.let { put("tokenCount", it) }
                        put("stopReason", output.stopReason)
                    })
                }
                result.onFailure { err ->
                    call.resolve(JSObject().apply {
                        put("text", "")
                        put("stopReason", "error")
                        put("errorMessage", err.message ?: "unknown error")
                    })
                }
            },
        )
    }

    // --- Import from device (file picker) ------------------------------------

    @PluginMethod
    fun importModelFile(call: PluginCall) {
        call.setKeepAlive(true)
        importCall = call
        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            type = "*/*"
        }
        startActivityForResult(call, intent, REQUEST_IMPORT)
    }

    override fun handleOnActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.handleOnActivityResult(requestCode, resultCode, data)
        if (requestCode != REQUEST_IMPORT) return
        val call = importCall ?: return
        importCall = null
        if (resultCode != Activity.RESULT_OK || data?.data == null) {
            call.reject("cancelled")
            return
        }
        engine.importFromUri(
            resolver = context.contentResolver,
            uri = data.data!!,
            onProgress = { bytes, total ->
                notifyListeners("importProgress", JSObject().apply {
                    put("bytesWritten", bytes)
                    put("totalBytes", total)
                })
            },
            onComplete = { result ->
                result.onSuccess { path ->
                    call.resolve(JSObject().apply { put("path", path) })
                }
                result.onFailure { err ->
                    call.reject(err.message ?: "import failed", Exception(err))
                }
            },
        )
    }

    // --- Device model scanner (AI Edge Gallery / Pixel AICore) ---------------

    @PluginMethod
    fun detectDeviceModels(call: PluginCall) {
        val arr = JSONArray()
        val hasAccess = Build.VERSION.SDK_INT < Build.VERSION_CODES.R ||
            Environment.isExternalStorageManager()

        fun scanDir(root: File, namePrefix: String) {
            if (!root.exists()) return
            root.walkTopDown()
                .filter { it.isFile && it.name.endsWith(".litertlm") }
                .forEach { f ->
                    arr.put(JSObject().apply {
                        put("path", f.absolutePath)
                        put("name", "$namePrefix: ${f.parentFile?.name ?: f.nameWithoutExtension}")
                        put("sizeBytes", f.length())
                    })
                }
        }

        if (hasAccess) {
            scanDir(File("/sdcard/Android/data/com.google.ai.edge.gallery/files"), "AI Edge Gallery")
            scanDir(File("/sdcard/Android/data/com.google.aiedge.gallery/files"), "AI Edge Gallery")
            scanDir(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), "Downloads")
        }

        call.resolve(JSObject().apply { put("models", arr) })
    }

    @PluginMethod
    fun importModelFromPath(call: PluginCall) {
        val path = call.getString("path")
        if (path.isNullOrBlank()) {
            call.reject("path is required")
            return
        }
        engine.importFromPath(
            File(path),
            onProgress = { bytes, total ->
                notifyListeners("importProgress", JSObject().apply {
                    put("bytesWritten", bytes)
                    put("totalBytes", total)
                })
            },
            onComplete = { result ->
                result.onSuccess { p ->
                    call.resolve(JSObject().apply { put("path", p) })
                }
                result.onFailure { err ->
                    call.reject(err.message ?: "import failed", Exception(err))
                }
            },
        )
    }

    // --- All-files-access permission -----------------------------------------

    @PluginMethod
    fun hasAllFilesAccess(call: PluginCall) {
        val granted = Build.VERSION.SDK_INT < Build.VERSION_CODES.R ||
            Environment.isExternalStorageManager()
        call.resolve(JSObject().apply { put("granted", granted) })
    }

    @PluginMethod
    fun requestAllFilesAccess(call: PluginCall) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R &&
            !Environment.isExternalStorageManager()
        ) {
            val packageUri = Uri.parse("package:${context.packageName}")
            val intent = try {
                Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION, packageUri)
                    .also { activity.packageManager.resolveActivity(it, 0)
                        ?: throw ActivityNotFoundException() }
            } catch (_: ActivityNotFoundException) {
                Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, packageUri)
            }
            activity.startActivity(intent)
        }
        call.resolve()
    }

    // --- AICore (ML Kit GenAI) -----------------------------------------------

    @PluginMethod
    fun aiCoreStatus(call: PluginCall) {
        scope.launch {
            val result = runCatching { aiCore.checkStatus() }
            withContext(Dispatchers.Main) {
                result.fold(
                    onSuccess = { r ->
                        call.resolve(JSObject().apply {
                            put("status", r.status.name.lowercase())
                            r.tokenLimit?.let { put("tokenLimit", it) }
                        })
                    },
                    onFailure = { err ->
                        // Treat any unexpected error as unavailable so the TS
                        // side falls through to the LiteRT path gracefully.
                        call.resolve(JSObject().apply {
                            put("status", "unavailable")
                            put("error", err.message ?: "unknown")
                        })
                    },
                )
            }
        }
    }

    @PluginMethod
    fun aiCoreWarmup(call: PluginCall) {
        scope.launch {
            runCatching { aiCore.warmup() }
            withContext(Dispatchers.Main) { call.resolve() }
        }
    }

    @PluginMethod
    fun aiCoreGenerate(call: PluginCall) {
        val prompt = call.getString("prompt")
        if (prompt.isNullOrBlank()) {
            call.reject("prompt is required")
            return
        }
        val maxTokens = call.getInt("maxTokens") ?: 512
        scope.launch {
            val result = runCatching { aiCore.generate(prompt, maxTokens) }
            withContext(Dispatchers.Main) {
                result.fold(
                    onSuccess = { r ->
                        call.resolve(JSObject().apply {
                            put("text", r.text)
                            put("finishReason", r.finishReason)
                        })
                    },
                    onFailure = { err ->
                        call.reject(err.message ?: "aicore generate failed", Exception(err))
                    },
                )
            }
        }
    }

    override fun handleOnDestroy() {
        scope.cancel()
        aiCore.close()
        engine.close()
        super.handleOnDestroy()
    }
}
