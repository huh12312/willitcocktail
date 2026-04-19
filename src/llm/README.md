# LLM Layer

Providers for fuzzy pantry parsing and intent search (approach.md §7).

## Structure

- `provider.ts` — `LlmProvider` interface, shared types, keyword vocabularies used by the heuristic fallback.
- `tools.ts` — deterministic tools the model (or heuristic) calls: `search_recipes`, `get_recipe`, `get_substitutes`, `check_pantry`. Hierarchy-aware.
- `heuristic.ts` — offline provider. Alias map + Levenshtein (≤2) + substring for ingredient parsing; keyword-to-tag/family extraction for intent search. No model needed — always available.
- `litert-lm.ts` — on-device provider (Gemma 4 E2B via LiteRT-LM). Stub today; activates when the native plugin ships.
- `index.ts` — `getLlmProvider()` factory. Returns LitertLm if available, else Heuristic.

## Native plugin work (not done yet)

`LitertLmProvider.isAvailable()` returns `false` until a Capacitor plugin implementing `LiteRtLmPlugin` (see `litert-lm.ts`) is registered. The plugin needs:

1. **Kotlin** module that loads a Gemma `.task` or `.litertlm` asset and exposes `modelStatus`, `downloadModel`, `runInference`.
2. **LiteRT-LM** dependency wired into `android/app/build.gradle` (see Google's LiteRT-LM Android samples).
3. **Model download** — first launch pulls the ~1.3 GB Gemma 4 E2B weights into app-private storage; progress events via `addDownloadListener`.
4. **Function-calling loop** — `runInference` accepts the tool schemas from `tools.ts::TOOL_SCHEMAS` and returns tool calls, which the TS side executes and feeds back.
5. **JSON-schema constrained decoding** for final responses, so the model output parses cleanly into `ParsedPantry` / `IntentSearchResult`.

Until that lands, all UI paths run through `HeuristicProvider` — no regression in functionality, just less forgiving parsing.
