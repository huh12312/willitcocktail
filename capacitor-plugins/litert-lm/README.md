# LiteRtLm Capacitor Plugin

On-device LLM bridge for Android, backing `LitertLmProvider` in `src/llm/`.
Wraps Google's [MediaPipe GenAI LLM Inference API](https://ai.google.dev/edge/mediapipe/solutions/genai/llm_inference)
(the API surface LiteRT-LM ships behind; the brand has been shifting —
confirm the current name and coord before wiring).

## Files

```
android/src/main/java/com/willitcocktail/litertlm/
├── LiteRtLmPlugin.kt   # Capacitor bridge — call plumbing + events
└── LiteRtEngine.kt     # Model download, MediaPipe engine lifecycle
```

## Integrating into the app

This project doesn't yet have an `android/` platform (no `npx cap add android`
has been run). When you do:

1. **Scaffold** the Android platform:
   ```
   npm run build
   npx cap add android
   npx cap sync
   ```

2. **Copy the Kotlin sources** into the generated project:
   ```
   mkdir -p android/app/src/main/java/com/willitcocktail/litertlm
   cp capacitor-plugins/litert-lm/android/src/main/java/com/willitcocktail/litertlm/* \
      android/app/src/main/java/com/willitcocktail/litertlm/
   ```

3. **Register the plugin** in `android/app/src/main/java/.../MainActivity.kt`:
   ```kotlin
   import com.getcapacitor.BridgeActivity
   import com.willitcocktail.litertlm.LiteRtLmPlugin

   class MainActivity : BridgeActivity() {
     override fun onCreate(savedInstanceState: Bundle?) {
       registerPlugin(LiteRtLmPlugin::class.java)
       super.onCreate(savedInstanceState)
     }
   }
   ```

4. **Add the MediaPipe GenAI dependency** to `android/app/build.gradle`
   (inside the `dependencies { … }` block):
   ```gradle
   // Verify the current coord at:
   // https://developers.google.com/mediapipe/solutions/genai/llm_inference/android
   implementation 'com.google.mediapipe:tasks-genai:0.10.24'
   ```

   If Google has since renamed the artifact under the LiteRT-LM umbrella
   (likely `com.google.ai.edge.litertlm:…`), swap the coord and adjust the
   two `import com.google.mediapipe…` lines in `LiteRtEngine.kt` — the class
   names (`LlmInference`, `LlmInferenceSession`) have been stable across the
   rename.

5. **Permissions.** `INTERNET` is declared via the plugin's
   `@CapacitorPlugin` annotation. If you block exfil in the manifest, keep
   it allowed for the model download endpoint you configure.

6. **Model hosting.** The `.task` file (~1.3 GB for Gemma 4 E2B) does NOT
   ship with the APK — it downloads on first use. Point the app at a URL
   you control. Options:
   - Kaggle/HuggingFace-hosted `.task` bundle behind a pre-signed URL
   - Your own CDN / R2 / S3 bucket
   - A dev-time `adb push` for local testing:
     ```
     adb push gemma-2b-it-cpu.task /data/local/tmp/
     adb shell run-as com.willitcocktail.app cp /data/local/tmp/gemma-2b-it-cpu.task files/llm/gemma.task
     ```

   Configure the URL from TS via `LiteRtLmPlugin.setModelConfig({ url, expectedSha256 })`.
   The SHA check is optional but strongly recommended — without it, a MITM
   or a swapped upstream artifact could feed arbitrary weights to the
   on-device engine.

## Testing

On-device testing only. This plugin cannot be exercised from the vitest
suite — TS-side prompt building and JSON parsing are covered in
`src/llm/litert-lm.test.ts`; runtime behaviour is verified by running the
debug APK against a real model.

## Notes on the current state

- **Constrained decoding** (`jsonSchema`) is wired reflectively: if the
  installed MediaPipe version doesn't expose `setJsonSchema`, the plugin
  silently falls back to prompt-only JSON generation, and the TS-side
  `safeJsonParse` handles model-level deviations (code fences, trailing
  commas, a paragraph of apology before the JSON).
- **No token streaming.** Single-shot generate only. Adding a streaming
  channel is possible (`notifyListeners("token", …)`) but not worth the
  complexity until a product flow needs it.
- **Single global engine.** Changing the model file via
  `setModelConfig(url=…)` drops the engine; it reinitialises on the next
  `generate()` call. Concurrent generate() calls are serialised on a
  single-thread executor — the engine is not thread-safe.
