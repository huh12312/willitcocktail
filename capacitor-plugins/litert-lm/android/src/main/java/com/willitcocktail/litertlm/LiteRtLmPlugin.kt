package com.willitcocktail.litertlm

import android.Manifest
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import org.json.JSONObject

/**
 * Capacitor bridge to the on-device LLM engine (LiteRT-LM / MediaPipe GenAI).
 *
 * The heavy lifting lives in [LiteRtEngine] so that this class stays focused
 * on call-plumbing. Kotlin-side we keep a single engine instance, lazily
 * initialised after a model is downloaded.
 *
 * ## Wiring into an app
 *
 * 1. Copy this file into your Android module's source tree, keeping the
 *    package unchanged.
 * 2. Register the plugin in `MainActivity.onCreate`:
 *
 *        class MainActivity : BridgeActivity() {
 *          override fun onCreate(savedInstanceState: Bundle?) {
 *            registerPlugin(LiteRtLmPlugin::class.java)
 *            super.onCreate(savedInstanceState)
 *          }
 *        }
 *
 * 3. Add the LiteRT-LM / MediaPipe GenAI dependency to `app/build.gradle`.
 *    See README.md in this directory — the coord is left there (not here) so
 *    a version bump doesn't require code changes.
 */
@CapacitorPlugin(
    name = "LiteRtLm",
    permissions = [Permission(alias = "network", strings = [Manifest.permission.INTERNET])],
)
class LiteRtLmPlugin : Plugin() {
    private val engine: LiteRtEngine by lazy { LiteRtEngine(context) }

    @PluginMethod
    fun modelStatus(call: PluginCall) {
        val status = engine.status()
        val out = JSObject().apply {
            put("downloaded", status.downloaded)
            put("ready", status.ready)
            status.path?.let { put("path", it) }
            status.sizeBytes?.let { put("sizeBytes", it) }
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
                val evt = JSObject().apply {
                    put("bytesDownloaded", bytes)
                    put("totalBytes", total)
                }
                notifyListeners("downloadProgress", evt)
            },
            onComplete = { result ->
                result.onSuccess { path ->
                    val out = JSObject().apply { put("path", path) }
                    call.resolve(out)
                }
                result.onFailure { err ->
                    call.reject(err.message ?: "download failed", err)
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
            call.reject(t.message ?: "delete failed", t)
        }
    }

    @PluginMethod
    fun generate(call: PluginCall) {
        val prompt = call.getString("prompt")
        if (prompt.isNullOrBlank()) {
            call.reject("prompt is required")
            return
        }
        val maxTokens = call.getInt("maxTokens") ?: 512
        val temperature = call.getFloat("temperature") ?: 0.3f
        val topK = call.getInt("topK") ?: 40
        val jsonSchemaRaw = call.getString("jsonSchema")
        val jsonSchema = jsonSchemaRaw
            ?.takeIf { it.isNotBlank() }
            ?.let { runCatching { JSONObject(it) }.getOrNull() }

        engine.generateAsync(
            prompt = prompt,
            maxTokens = maxTokens,
            temperature = temperature,
            topK = topK,
            jsonSchema = jsonSchema,
            onComplete = { result ->
                result.onSuccess { output ->
                    val out = JSObject().apply {
                        put("text", output.text)
                        output.tokenCount?.let { put("tokenCount", it) }
                        put("stopReason", output.stopReason)
                    }
                    call.resolve(out)
                }
                result.onFailure { err ->
                    val out = JSObject().apply {
                        put("text", "")
                        put("stopReason", "error")
                        put("errorMessage", err.message ?: "unknown error")
                    }
                    // Resolve (not reject) so TS-side can surface the
                    // GenerateResult.stopReason=error UX uniformly. Rejects
                    // would force every caller into try/catch when an
                    // expected failure path already exists.
                    call.resolve(out)
                }
            },
        )
    }

    override fun handleOnDestroy() {
        engine.close()
        super.handleOnDestroy()
    }
}
