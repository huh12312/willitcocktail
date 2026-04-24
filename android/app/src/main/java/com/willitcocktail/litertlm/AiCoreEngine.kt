package com.willitcocktail.litertlm

import com.google.mlkit.genai.common.FeatureStatus
import com.google.mlkit.genai.prompt.Candidate
import com.google.mlkit.genai.prompt.Generation
import com.google.mlkit.genai.prompt.GenerativeModel
import com.google.mlkit.genai.prompt.TextPart
import com.google.mlkit.genai.prompt.generateContentRequest
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

// Typed wrapper around FeatureStatus @IntDef constants.
enum class AiCoreStatus { AVAILABLE, DOWNLOADABLE, DOWNLOADING, UNAVAILABLE }

data class AiCoreStatusResult(
    val status: AiCoreStatus,
    // Only populated when status == AVAILABLE; device-specific context window.
    val tokenLimit: Int?,
)

data class AiCoreGenerateResult(
    val text: String,
    val finishReason: String, // "stop" | "max_tokens" | "other"
)

/**
 * Wraps the ML Kit GenAI Prompt API (genai-prompt:1.0.0-beta2).
 *
 * Uses Gemini Nano via the AICore system service — no model file is managed
 * by this app. Reliable on Pixel 9+ (Tensor G4, Android 14); Pixel 8/8a
 * require a developer-options toggle and are not the production floor.
 *
 * Note: The underlying model is Gemini Nano, not Gemma 4 E2B. Prompts were
 * authored for Gemma; output quality may differ. safeJsonParse on the TS
 * side handles format deviations gracefully, returning null on total failure.
 *
 * No jsonSchema constrained decoding: ML Kit does not expose that surface.
 * The prompt text describes the required JSON shape explicitly.
 *
 * API surface verified from genai-prompt-1.0.0-beta2.jar via javap:
 *   - Generation.getClient() no-arg  ✓
 *   - checkStatus()/warmup()/getTokenLimit() are suspend fns (Continuation)  ✓
 *   - generateContentRequest(TextPart) { } DSL exists in GenerateContentRequestKt  ✓
 *   - Candidate.FinishReason is an @IntDef (int constants), not an enum  ✓
 */
class AiCoreEngine {
    private var model: GenerativeModel? = null

    private fun getModel(): GenerativeModel =
        model ?: Generation.getClient().also { model = it }

    suspend fun checkStatus(): AiCoreStatusResult = withContext(Dispatchers.IO) {
        val m = getModel()
        val raw = m.checkStatus()
        val status = when (raw) {
            FeatureStatus.AVAILABLE    -> AiCoreStatus.AVAILABLE
            FeatureStatus.DOWNLOADABLE -> AiCoreStatus.DOWNLOADABLE
            FeatureStatus.DOWNLOADING  -> AiCoreStatus.DOWNLOADING
            else                       -> AiCoreStatus.UNAVAILABLE
        }
        val tokenLimit = if (status == AiCoreStatus.AVAILABLE) {
            runCatching { m.getTokenLimit() }.getOrNull()
        } else null
        AiCoreStatusResult(status, tokenLimit)
    }

    /** Warms up the model to reduce first-inference cold-start latency. */
    suspend fun warmup() = withContext(Dispatchers.IO) {
        runCatching { getModel().warmup() }
        Unit
    }

    suspend fun generate(prompt: String, maxTokens: Int): AiCoreGenerateResult =
        withContext(Dispatchers.IO) {
            val m = getModel()
            val request = generateContentRequest(TextPart(prompt)) {
                maxOutputTokens = maxTokens
            }
            val response = m.generateContent(request)
            val candidate = response.candidates.firstOrNull()
            // FinishReason is an @IntDef, not an enum — map constants manually.
            val finishReason = when (candidate?.finishReason) {
                Candidate.FinishReason.MAX_TOKENS -> "max_tokens"
                Candidate.FinishReason.OTHER      -> "other"
                else                              -> "stop"
            }
            AiCoreGenerateResult(
                text = candidate?.text ?: "",
                finishReason = finishReason,
            )
        }

    fun close() {
        model?.close()
        model = null
    }
}
