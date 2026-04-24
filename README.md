# Will It Cocktail

**Android-first, offline-capable cocktail app.** Given the bottles and mixers in your pantry, it tells you what you can make right now — and invents new drinks from what you have.

---

## What it does

### Pantry
Add the spirits, liqueurs, mixers, and other ingredients you stock. Use the Quick Add box to paste a free-form list ("gin, sweet vermouth, campari, lime juice") and the parser resolves phrases to canonical ingredients. Unrecognized items — or low-confidence fuzzy matches — can be saved as **custom ingredients** (e.g. "Walnut Bitters", "Uncle Nearest 1856") that behave like first-class pantry entries throughout the app.

### Matches
Deterministic three-tier matcher runs entirely offline:
- **Make now** — every required ingredient is in your pantry
- **Substitute needed** — one ingredient can be swapped for something you have (substitute strength ≥ 0.7)
- **Need one** — missing exactly one non-optional ingredient

Results ranked by IBA-official status then match quality. Strict mode toggle hides substitution and near-matches.

### Ask
Free-text intent search powered by an LLM. Type "something bitter and stirred" or "tropical rum drink" and the app runs two parallel requests:

1. **From our recipes** — searches the 3,989-recipe corpus and ranks by pantry availability, with makeability badges and substitute hints
2. **Created for you** — generates novel drinks from your pantry using cocktail family balance rules (sour, highball, martini, etc.); can suggest additional ingredients outside your current stock ("also works well with: 2 dashes cardamom bitters")

Both sections are collapsible. Invented recipes can be saved to a persistent collection.

### Recipes
Searchable, filterable index of all 3,989 recipes. Filter by family, method, or free-text across name and ingredients. Tap any recipe to see the full card with ingredients, instructions, and garnish.

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite + TypeScript + Tailwind CSS |
| Mobile | Capacitor 6.x (Android) |
| Local DB | SQLite — `@capacitor-community/sqlite` (native) / sql.js (web) |
| On-device LLM | LiteRT-LM 0.10.2, Gemma 4 E2B (`.litertlm` format) |
| System LLM | ML Kit GenAI Prompt API — Gemini Nano via AICore (Pixel 9+) |
| Cloud LLM | Any OpenAI-compatible API |
| State | Zustand + persist middleware |
| DB sync | GitHub Pages (weekly Actions cron) |

---

## Recipe corpus

3,989 recipes normalized to a canonical ingredient schema:

| Source | Count | Notes |
|--------|-------|-------|
| IBA official | ~90 | Authoritative recipes, hand-curated |
| HuggingFace `erwanlc/cocktails_recipe` | ~3,600 | NLP-tagged, alias-normalized |
| CocktailDB (free tier) | ~212 | Letter-search import |

---

## On-device LLM

Three inference paths tried in priority order at runtime:

1. **AICore / Gemini Nano** (Pixel 9+, Android 14+) — system-resident model via ML Kit GenAI Prompt API. Zero download required. Detected via `checkStatus()`.
2. **LiteRT-LM / Gemma 4 E2B** — loads a locally-stored `.litertlm` model file (~1.2 GB). GPU backend (Adreno/Mali via WebGPU) attempted first; if GPU inference fails it demotes permanently to CPU (persisted via SharedPreferences). Model installed by:
   - In-app download flow
   - Copy from AI Edge Gallery (`/sdcard/Android/data/com.google.ai.edge.gallery/files/`)
   - File picker sideload
3. **Offline heuristic** — keyword matcher, no model, always available

Active provider and backend (`gpu`/`cpu`) shown in Settings.

---

## Development

```bash
npm install
npm run dev          # Vite dev server — localhost:5173
npm run test         # Vitest
npm run typecheck    # tsc --noEmit
npm run build        # production web build → dist/
```

### Environment variables

Copy `.env.example` to `.env.local`:

```bash
# Weekly DB snapshot sync (web only — Android uses bundled DB)
VITE_SNAPSHOT_URL=https://huh12312.github.io/willitcocktail/snapshots

# Optional: override Gemma model URL / sha256
VITE_MODEL_URL=
VITE_MODEL_SHA256=
```

---

## Data pipeline

Source of truth is TypeScript (`src/data/ingredients.ts`, `src/data/recipes.ts`, `src/data/recipes_hf.ts`, `src/data/recipes_cocktaildb.ts`). The pipeline exports to SQLite:

```bash
npm run pipeline            # export → build DB → emit version manifest
npm run pipeline:export     # TS → data-pipeline/seed.json
npm run pipeline:build      # seed.json → public/cocktails.db
npm run pipeline:version    # write public/db-version.json (sha256 + unix-ts version)
npm run pipeline:cocktaildb # fetch CocktailDB free tier → cocktaildb_candidates.json
```

### Adding CocktailDB recipes

```bash
npm run pipeline:cocktaildb
# review data-pipeline/cocktaildb_candidates.json — especially topUnmapped
# add aliases to src/data/ingredients.ts to improve yield, repeat
python3 data-pipeline/import_cocktaildb.py \
  --emit-ts src/data/recipes_cocktaildb.ts
# review the TS file, then:
npm run pipeline
```

---

## Android build

```bash
npm run build && npx cap sync android

# Debug
cd android && ./gradlew :app:assembleDebug

# Release (requires keystore env vars)
cd android && ./gradlew :app:assembleRelease
```

**Signing env vars:** `ANDROID_KEYSTORE_PATH`, `ANDROID_STORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`

```bash
# Install to connected device
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

---

## Weekly DB sync

**GitHub Actions workflows:**

- `publish-db.yml` — rebuilds `cocktails.db` every Monday 06:17 UTC and deploys to GitHub Pages under `/snapshots/`. Keeps the 3 most recent versioned archives.
- `snapshot-rollback.yml` — manual dispatch: provide a version timestamp to restore a previous snapshot as the live version.

**Client (web only):** On cold start, fetches `{VITE_SNAPSHOT_URL}/db-version.json`, compares to the loaded DB version, downloads + sha256-verifies if newer, stores in IndexedDB, applies on next load. Android gets DB updates via new APK installs.

---

## Settings panel

- **Provider** — Auto / On-device / Cloud / Heuristic
- **On-device model** — status (downloaded / ready + gpu/cpu badge), model URL, download, import, AI Edge Gallery scan, AICore availability chip
- **Cloud** — base URL, model name, API key (any OpenAI-compatible endpoint)
- **Recipe database** — current DB version; web shows last-check time and manual update controls
