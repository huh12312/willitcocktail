# LLM Layer

Providers for fuzzy pantry parsing and intent search (approach.md §7).

## Structure

- `provider.ts` — `LlmProvider` interface, shared types, keyword vocabularies used by the heuristic fallback.
- `tools.ts` — deterministic tools the model (or heuristic) calls: `search_recipes`, `get_recipe`, `get_substitutes`, `check_pantry`. Hierarchy-aware.
- `heuristic.ts` — offline provider. Alias map + Levenshtein (≤2) + substring for ingredient parsing; keyword-to-tag/family extraction for intent search. No model needed — always available.
- `litert-lm.ts` — on-device provider (Gemma via LiteRT-LM / MediaPipe GenAI). Wraps the `LiteRtLm` Capacitor plugin; activates on Android once the plugin is registered and the model file is present. See `capacitor-plugins/litert-lm/` for the Kotlin side.
- `index.ts` — `getLlmProvider()` factory. Returns LitertLm if available, else Heuristic.

## Native plugin

Lives at `capacitor-plugins/litert-lm/` (Kotlin). Surface is intentionally narrow:

- `modelStatus()` → `{ downloaded, ready, path?, sizeBytes? }`
- `setModelConfig({ url, expectedSha256? })`
- `downloadModel()` + `downloadProgress` events
- `deleteModel()`
- `generate({ prompt, maxTokens?, temperature?, topK?, jsonSchema? })` → `{ text, stopReason, tokenCount? }`

Multi-turn tool loops stay in TypeScript — `parseIngredients` / `searchIntent` / `proposeRecipe` each do one deterministic pre-retrieval step (e.g. pantry matcher, IBA fallback) and one constrained generate call, then map the JSON into the provider's typed result shape. This is slower to iterate on than multi-turn, but on-device context budgets make single-shot the only realistic option for a 2B-class model.

Plugin integration, Maven coord selection, and model hosting decisions live in `capacitor-plugins/litert-lm/README.md`. Until the Android build is wired and a model is downloaded, `isAvailable()` returns `false` and the auto-priority chain falls through to cloud → heuristic exactly as before.
