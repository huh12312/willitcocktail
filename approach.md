# Will It Cocktail — End-to-End Approach

**Android-first, offline-capable cocktail app with on-device LLM-assisted fuzzy matching and recipe generation.**

---

## 1. Vision

A mobile app that answers two questions well:

1. **"What can I make right now?"** — given the bottles, mixers, and fresh ingredients I have, show me cocktails I can actually produce, ranked by how good they'll be.
2. **"Invent me something."** — given my pantry and a vibe, generate a novel cocktail that respects real cocktail structure (balance ratios, family grammar, flavor bridging) and is likely to taste good.

The differentiator is the combination: a grounded, fast deterministic matcher for "what can I make," augmented with an on-device reasoning model for fuzzy intent and creative generation. No cloud dependency for the core experience.

**Target platform for v1: Android only.** iOS follows in v2 once the on-device model story is validated on the easier platform.

---

## 2. Data Landscape

Four viable sources evaluated:

| Source | Size | Strengths | Weaknesses |
|--------|------|-----------|------------|
| **TheCocktailDB** | ~636 recipes, 489 ingredients | Free JSON API, thumbnails, popular/recent endpoints (premium) | Multi-ingredient filter behind $3 one-time paywall; ingredient strings not normalized |
| **CocktailFYI** | ~636 recipes | Free, no auth, CORS, ABV/calories, ingredient substitution endpoint, OpenAPI spec | Smaller mindshare, less community validation |
| **IBA GitHub (rasmusab/iba-cocktails)** | ~90 official IBA recipes | Clean CSV/JSON, one row per ingredient, parsed quantity/unit, canonical source | Small corpus, 2023-vintage, not updated |
| **HuggingFace (brianarbuckle, erwanlc)** | Thousands of recipes scraped from Death & Co., Diffords, 1001cocktails | Large, diverse, includes NER tags | Messy, inconsistent formatting, attribution fuzzy |

**Strategy:**
- **Seed with IBA** for the canonical 90 (clean, authoritative, debuggable)
- **Enrich with CocktailDB Premium ($3 one-time)** for breadth and images
- **Augment with CocktailFYI** for substitutes, ABV, nutrition
- **HuggingFace datasets** as a later expansion source once ingestion pipeline is hardened

All ingested at build/sync time, normalized into a canonical schema, shipped as an embedded SQLite database.

---

## 3. Architecture

```
┌────────────────────────────────────────────────────────────┐
│  Android app (Capacitor + React + Vite + Tailwind)         │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ UI layer                                             │  │
│  │  • Pantry management                                 │  │
│  │  • Recipe browse / search                            │  │
│  │  • "Invent mode"                                     │  │
│  │  • Saved / rated drinks                              │  │
│  └──────────────────────────────────────────────────────┘  │
│                        ↓                                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Matcher service (TypeScript, runs in WebView)        │  │
│  │  • Exact match (pantry ⊇ recipe.ingredients)         │  │
│  │  • Near match (missing ≤ 1 non-critical ingredient)  │  │
│  │  • Substitute match (via substitute graph)           │  │
│  │  • Ranked output                                     │  │
│  └──────────────────────────────────────────────────────┘  │
│                        ↓ (for fuzzy/creative queries)      │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Gemma 4 E2B via LiteRT-LM (on-device)                │  │
│  │  • Freeform pantry entry parsing                     │  │
│  │  • Intent-based fuzzy search ("something refreshing")│  │
│  │  • Substitute reasoning                              │  │
│  │  • Novel recipe generation                           │  │
│  │  • Function calling into matcher as tools            │  │
│  │  • Constrained decoding for schema safety            │  │
│  └──────────────────────────────────────────────────────┘  │
│                        ↓                                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ SQLite (embedded, ~2MB)                              │  │
│  │  • ingredients, aliases, substitutes                 │  │
│  │  • recipes, recipe_ingredients                       │  │
│  │  • user_pantry, user_ratings, user_generated         │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────┘
                           ↕ (optional, weekly)
┌────────────────────────────────────────────────────────────┐
│  Sync backend (FastAPI, Dockerized)                        │
│  • Pulls from CocktailDB + CocktailFYI + IBA               │
│  • Normalizes, dedupes, diffs                              │
│  • Publishes SQLite delta or full snapshot                 │
│  • (Later) user accounts, generated-recipe sharing         │
└────────────────────────────────────────────────────────────┘
```

### Why this shape

- **Offline-first.** The core loop (pantry → matches) works with no network. Recipes live on-device as SQLite. This matters at a bar with bad wifi or in a kitchen that just lost signal.
- **LLM as reasoner, not source of truth.** Every ingredient the model names is looked up against your canonical table. Every recipe it returns is either a real DB record or a generated record validated against family rules. Hallucinations are architecturally prevented, not merely prompted against.
- **Server is optional.** v1 can ship with zero backend — just a static SQLite bundled into the APK. Backend appears in Phase 4 only when sync and sharing become necessary.

---

## 4. Tech Stack

### Frontend
- **React 18 + Vite + TypeScript** — fast dev loop, standard tooling
- **Tailwind CSS** — utility-first, ships clean with Capacitor's WebView
- **shadcn/ui** components — consistent design system without heavy framework lock-in
- **Zustand** for state (pantry, preferences); TanStack Query for async
- **sql.js** or **@capacitor-community/sqlite** for local DB access

### Mobile wrapper
- **Capacitor 6.x** — web-first build pipeline, native binary output
- **@capacitor-community/sqlite** plugin for proper on-device SQLite
- **LiteRT-LM** (Google's on-device LLM runtime) for Gemma 4 E2B inference
- **AICore Developer Preview** integration where available (system-resident Gemma 4 on newer Pixels means zero model download)

### On-device model
- **Gemma 4 E2B** (Effective 2B params, ~1.2-1.5GB quantized with LiteRT's 2/4-bit weights)
- **Fallback path:** older devices that can't run E2B → cloud API (Gemini Flash) with explicit user opt-in

### Backend (Phase 4+)
- **FastAPI** + **Postgres** + **Redis**, all in a single `docker-compose.yml`
- **Cron worker** for weekly recipe sync
- **LiteFS** or plain SQLite snapshots published to a CDN for client pull

### CI/CD
- **EAS Build not used** (that's Expo) — Capacitor produces a standard Android project, so:
- **GitHub Actions** with Android SDK → APK/AAB builds
- **Internal testing track** on Play Console first, production rollout after validation

---

## 5. Data Schema

```sql
-- Canonical ingredients
CREATE TABLE ingredients (
  id           TEXT PRIMARY KEY,       -- e.g. "lime_juice", "gin_london_dry"
  name         TEXT NOT NULL,           -- display name
  category     TEXT NOT NULL,           -- spirit|liqueur|mixer|juice|bitter|syrup|garnish|other
  parent_id    TEXT,                    -- for hierarchy: mezcal -> agave_spirit
  FOREIGN KEY (parent_id) REFERENCES ingredients(id)
);

-- String aliases -> canonical ID
CREATE TABLE ingredient_aliases (
  alias         TEXT PRIMARY KEY,       -- "fresh lime juice", "juice of 1 lime"
  ingredient_id TEXT NOT NULL,
  FOREIGN KEY (ingredient_id) REFERENCES ingredients(id)
);

-- Substitution graph
CREATE TABLE substitutes (
  ingredient_id    TEXT NOT NULL,
  substitute_id    TEXT NOT NULL,
  strength         REAL NOT NULL,       -- 1.0 = identical, 0.5 = passable, 0.2 = last resort
  notes            TEXT,                -- "sweeter, use less" etc.
  PRIMARY KEY (ingredient_id, substitute_id),
  FOREIGN KEY (ingredient_id) REFERENCES ingredients(id),
  FOREIGN KEY (substitute_id) REFERENCES ingredients(id)
);

-- Recipes
CREATE TABLE recipes (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  family          TEXT NOT NULL,        -- sour|highball|old_fashioned|spritz|martini|flip|fizz|julep|other
  method          TEXT NOT NULL,        -- shake|stir|build|blend|throw
  glass           TEXT NOT NULL,
  garnish         TEXT,
  instructions    TEXT NOT NULL,
  abv             REAL,
  calories        INTEGER,
  source          TEXT NOT NULL,        -- iba|cocktaildb|cocktailfyi|generated|user
  iba_official    BOOLEAN DEFAULT 0,
  created_at      INTEGER NOT NULL,
  parent_recipe_id TEXT,                -- for generated drinks that riff on a known one
  generated_by    TEXT,                 -- user_id or 'system'
  FOREIGN KEY (parent_recipe_id) REFERENCES recipes(id)
);

CREATE TABLE recipe_ingredients (
  recipe_id       TEXT NOT NULL,
  ingredient_id   TEXT NOT NULL,
  amount_ml       REAL,
  amount_display  TEXT,                 -- "1.5 oz" / "2 dashes" preserved as-is
  optional        BOOLEAN DEFAULT 0,
  position        INTEGER NOT NULL,     -- order in recipe
  notes           TEXT,                 -- "top with", "float", "muddled"
  PRIMARY KEY (recipe_id, ingredient_id, position),
  FOREIGN KEY (recipe_id) REFERENCES recipes(id),
  FOREIGN KEY (ingredient_id) REFERENCES ingredients(id)
);

-- User data (local)
CREATE TABLE user_pantry (
  ingredient_id   TEXT PRIMARY KEY,
  added_at        INTEGER NOT NULL,
  notes           TEXT,
  FOREIGN KEY (ingredient_id) REFERENCES ingredients(id)
);

CREATE TABLE user_ratings (
  recipe_id       TEXT NOT NULL,
  rating          INTEGER NOT NULL,     -- 1-5
  made_at         INTEGER NOT NULL,
  notes           TEXT,
  PRIMARY KEY (recipe_id, made_at),
  FOREIGN KEY (recipe_id) REFERENCES recipes(id)
);
```

**Indexes to create**: `recipe_ingredients(ingredient_id)` for the "who uses gin" lookup, `ingredient_aliases(alias)` for parsing, `substitutes(ingredient_id)` for the substitute fan-out.

---

## 6. Matching Engine

The deterministic matcher is the heart of the app. It runs in the WebView (TypeScript), queries SQLite directly, and returns results in <50ms for typical pantries.

### Three-tier match

**Tier 1: Exact match**
```
Recipe matches if: every non-optional recipe ingredient is in pantry.
Rank by: iba_official DESC, user_rating DESC, popularity DESC.
```

**Tier 2: Near match**
```
Recipe matches if: missing ≤ 1 non-optional ingredient AND missing ingredient has 
substitute in pantry with strength ≥ 0.7.
Show: "with {substitute_name} instead of {original}"
```

**Tier 3: Almost match**
```
Recipe matches if: missing exactly 1 non-optional ingredient AND no substitute available.
Show: "you need: {missing_ingredient}"
```

Three tiers, visually separated. User toggles "strict mode" to hide Tier 2 and 3.

### Ingredient hierarchy

Parent-child ingredient relationships let "gin" match "London Dry Gin," "Plymouth Gin," and "Old Tom Gin" without explicit aliases. Pantry containing `gin_london_dry` auto-satisfies any recipe calling for the generic parent `gin`.

---

## 7. Gemma 4 E2B Integration

### Why E2B specifically

- **~1.2-1.5GB memory footprint** with LiteRT's 2/4-bit quantization — fits on any Android phone from the last ~3 years
- **Native function calling** trained in (not prompt-coaxed) — reliable tool use for grounding responses in SQLite
- **Constrained decoding** via LiteRT-LM — schema compliance is enforced at decode time, not hoped for
- **Thinking mode** — explicit chain-of-thought before output, materially improves recipe generation quality
- **Apache 2.0 license** — commercial use, fine-tuning, distribution all clear
- **AICore on newer Android** — system-resident model on supported devices = zero app-bundle cost

### Four use cases

1. **Pantry parse** — freeform text or photo → structured ingredient list
2. **Intent search** — "something refreshing and herbaceous" → ranked recipes via tool-calling
3. **Substitute reasoning** — "can I use mezcal in a margarita?" → contextual answer
4. **Recipe generation** — pantry + optional vibe → novel recipe validated against family rules

### Function-calling tools exposed to the model

```typescript
tools = [
  {
    name: "search_recipes",
    description: "Search the recipe database by ingredients and/or flavor characteristics.",
    parameters: {
      has_ingredients: { type: "array", items: { enum: CANONICAL_INGREDIENT_IDS } },
      family: { type: "string", enum: ["sour","highball","old_fashioned","spritz","martini","flip","fizz","julep"] },
      flavor_tags: { type: "array", items: { enum: ["refreshing","herbaceous","citrus","smoky","bitter","sweet","spirit_forward","creamy","tropical","spicy"] } },
      max_results: { type: "number", default: 10 }
    }
  },
  {
    name: "get_recipe",
    description: "Fetch a single recipe by ID. Always use this before citing a recipe's ingredients.",
    parameters: { recipe_id: { type: "string" } }
  },
  {
    name: "get_substitutes",
    description: "Get possible substitutes for an ingredient, ranked by closeness.",
    parameters: { ingredient_id: { type: "string", enum: CANONICAL_INGREDIENT_IDS } }
  },
  {
    name: "check_pantry",
    description: "Check which of a list of ingredients are currently in the user's pantry.",
    parameters: { ingredient_ids: { type: "array", items: { enum: CANONICAL_INGREDIENT_IDS } } }
  }
]
```

All tool outputs feed back into the model context. The model can't return a recipe it hasn't verified through `get_recipe`, and can't claim an ingredient exists in the user's pantry without `check_pantry`.

### Constrained decoding schemas

Every LLM output is a JSON object validated at decode time. Three schemas matter most: pantry-parse, fuzzy-search-response, and generation. The generation schema is the critical one and is defined in detail in the Phase 3 section below.

---

## 8. Phased Build Plan

### Phase 1: Web MVP (weekend, ~2 days)

**Deliverable:** React + Vite + Tailwind app, deployed as a PWA, using the IBA dataset as a static JSON bundle.

- Pantry managed in `localStorage`
- Hardcoded IBA ~90 recipes as a JSON import
- Deterministic exact+near matcher in TypeScript
- Deployed to Vercel or Netlify
- No backend, no model, no Capacitor yet

**Purpose:** validate the UX flow and matching quality with zero infrastructure. If users can't find value in the pantry→matches loop with 90 recipes, more recipes won't fix it.

### Phase 2: Local DB + Android wrap (~1 week)

**Deliverable:** Capacitor-wrapped Android APK with embedded SQLite containing the full normalized corpus (IBA + CocktailDB + CocktailFYI).

- Build the ingestion pipeline (Python script): pull APIs, normalize ingredient strings against a hand-curated alias map, resolve to canonical IDs, dedupe, emit SQLite
- Alias map hand-seeded from the 90 IBA recipes, extended iteratively
- Embed `cocktails.db` in the APK assets
- @capacitor-community/sqlite for on-device access
- Port matcher to query SQLite
- Publish to Play Console internal testing track

**Purpose:** ship a working Android app with the complete deterministic experience. This is the MVP users could actually live with.

### Phase 3: Gemma 4 E2B — fuzzy match only (~1-2 weeks)

**Deliverable:** Same app, now with a "describe what you want" free-text field that invokes Gemma 4 E2B locally.

- LiteRT-LM integration via Capacitor custom plugin (or available community plugin)
- First-run model download flow (~1.2GB, with clear "optional feature" framing)
- Detect AICore availability on device — skip download if system-resident
- Implement the four function-calling tools against local SQLite
- Pantry-parse flow: freeform input → canonical ingredient list → add to pantry
- Intent search flow: freeform query → tool-calls → ranked matches with reasoning

**Purpose:** validate on-device LLM latency, battery, model-download UX on real user devices before expanding scope. Ship with generation disabled behind a feature flag.

### Phase 4: Recipe generation (~2 weeks)

**Deliverable:** "Invent mode" — generate novel cocktails from pantry with family-aware structure.

- Cocktail family grammar encoded in system prompt
- Few-shot examples dynamically pulled from SQLite (3-5 recipes matching pantry overlap)
- Constrained decoding schema for generation
- Three guardrails: schema validation, ratio sanity check, pantry availability check
- Save-to-collection flow with rating
- Thinking mode enabled for generation (slower but noticeably better quality)

**Purpose:** ship the creative differentiator. This is the feature that makes "Will It Cocktail" distinct from every other cocktail app.

### Phase 5: Backend sync (~1 week)

**Deliverable:** FastAPI service in Docker, publishes weekly-updated SQLite to clients.

- Scheduled GitHub Action or cron container: re-ingests all sources, emits new `cocktails.db`
- Client checks for update on cold start, downloads delta if available
- SQLite snapshot versioning for safe rollback

**Purpose:** keep the recipe corpus current without shipping a new APK every time a new cocktail appears.

### Phase 6 (optional): Fine-tune + community (~3-4 weeks)

- LoRA fine-tune Gemma 4 E2B on ~3-5k curated recipes → shipped as a small adapter (~tens of MB) loaded on top of the base model
- User accounts (Supabase is easiest)
- Share generated recipes to a community feed
- Upvotes, featured recipes, "bartender of the month"
- iOS port (Capacitor already supports it; the work is provisioning/App Store + validating LiteRT-LM on iOS)

---

## 9. Phase 3 System Prompt — Fuzzy Matching

Gemma 4 E2B receives this as its system message for intent-based search. It does not see the full recipe database; it sees only the tool definitions and must use them to ground every factual claim.

```
You are the reasoning engine for Will It Cocktail, a cocktail app.
Your job is to understand a user's freeform request and find cocktails that fit,
grounded entirely in calls to your tools. You never fabricate recipes, ingredients,
or pantry contents.

AVAILABLE TOOLS:
- search_recipes(has_ingredients?, family?, flavor_tags?, max_results?)
- get_recipe(recipe_id) — always call before citing a recipe's ingredients
- get_substitutes(ingredient_id)
- check_pantry(ingredient_ids)

RULES:
1. Every cocktail name you mention must come from a search_recipes or get_recipe result.
   If a cocktail is not in the database, say so — do not invent one in this mode.
2. Every ingredient you cite must be one you retrieved via get_recipe. Do not assume
   ingredients from memory.
3. The user's pantry is the source of truth. Never claim they have something without
   calling check_pantry first.
4. When a recipe needs an ingredient the user lacks, call get_substitutes to see if
   anything in their pantry can stand in. Only suggest substitutes with strength >= 0.7.

PROCESS:
1. Parse the user's request into: (a) mentioned ingredients (mapped to canonical IDs),
   (b) flavor tags (refreshing, herbaceous, smoky, etc.), (c) desired family if stated.
2. Call search_recipes with those parameters. Ask for up to 15 candidates.
3. For the top 5-8, call get_recipe to pull full ingredient lists.
4. Call check_pantry once with the union of all ingredients across those recipes.
5. For each recipe, determine: makeable now, makeable with substitution, or missing
   critical ingredients.
6. Re-rank by: fit to stated intent, then by makeability, then by IBA-official flag.
7. Return the top 5 with a one-sentence justification each, grounded in the recipe's
   actual ingredients and the user's actual pantry.

OUTPUT FORMAT:
Return a JSON object matching this schema:
{
  "interpretation": "one sentence restating what you think the user wants",
  "matches": [
    {
      "recipe_id": "<from get_recipe>",
      "recipe_name": "<from get_recipe>",
      "fit_reason": "<one sentence, citing specific ingredients or qualities>",
      "makeability": "now" | "with_substitute" | "missing_one",
      "substitutions": [{"original": "<ingredient_id>", "use": "<ingredient_id>"}],
      "missing": ["<ingredient_id>"]
    }
  ],
  "notes": "optional one-sentence summary or suggestion"
}

Do not include any prose outside the JSON object.
```

### Why this prompt is shaped this way

- **Tool-first framing.** The system prompt spends most of its words on *how to use tools*, not *how to be helpful*. This is the right trade for a small model — small models follow procedures better than they follow vibes.
- **Explicit anti-hallucination rules.** "Every cocktail name you mention must come from..." is direct and checkable. Gemma 4's function calling was trained for this pattern, so the prompt speaks its native idiom.
- **Process is numbered.** E2B-class models benefit from explicit step-by-step procedures. Numbered steps reduce the space of things the model might do.
- **Schema at the end, outside prose.** Constrained decoding will enforce the schema, but stating it in the prompt gives the thinking mode something to target during reasoning.
- **No persona fluff.** No "you are a friendly bartender named Marcus." Personas burn tokens and tempt small models into creative digressions. The app's UI provides personality; the model is infrastructure.

### Expected latency budget

- Parse + initial `search_recipes` call: ~400ms
- 5-8 parallel `get_recipe` calls: ~100ms (local SQLite, near-instant; batched)
- `check_pantry` call: ~50ms
- Re-rank + JSON emit: ~500ms

**Total: ~1-1.2s** on a mid-range 2024 Android device. Under 2s is the target; above 3s is unacceptable and triggers a fallback to the deterministic matcher with a banner ("AI search unavailable, showing standard matches").

---

## 10. Phase 4 System Prompt — Recipe Generation

Generation uses a separate system prompt because the model's job is now creative rather than retrieval. Tools are still available (for looking up similar recipes as inspiration), but the output is a novel recipe object.

```
You are the recipe designer for Will It Cocktail. Your job is to invent new
cocktails that are (a) balanced according to classic cocktail structure,
(b) plausible as drinks someone would enjoy, and (c) buildable from the user's
stated pantry.

COCKTAIL FAMILIES AND THEIR BALANCE RULES:

- SOUR: 2 parts spirit : 1 part citrus : 1 part sweetener. Optional egg white
  (dry shake, then wet shake). Examples: Whiskey Sour, Daiquiri, Margarita,
  Sidecar. Served up, in coupe.

- HIGHBALL: 1 part spirit : 3-4 parts carbonated mixer. Built in glass over ice.
  Examples: Gin & Tonic, Paloma, Dark 'n Stormy. Served long, in Collins/highball.

- OLD FASHIONED: ~2 oz spirit, 1 tsp sweetener (sugar, syrup, or liqueur), 2-3
  dashes bitters. Stirred, served over a large rock. Examples: Old Fashioned,
  Sazerac, Oaxaca Old Fashioned.

- SPRITZ: 3 parts sparkling wine : 2 parts bitter liqueur : 1 splash soda. Built
  in wine glass over ice. Examples: Aperol Spritz, Hugo Spritz.

- MARTINI (stirred, spirit-forward): 2-3 parts base spirit : 0.5-1 part modifier
  (vermouth, amaro, liqueur). Stirred, served up. Examples: Martini, Manhattan,
  Negroni, Boulevardier.

- FLIP: 2 oz spirit/wine : 1 tsp sugar : 1 whole egg. Shaken hard, up.
  Examples: Brandy Flip, Port Flip.

- FIZZ: Similar to sour but with soda water to top, served long.
  Examples: Gin Fizz, Ramos Gin Fizz, Silver Fizz.

- JULEP: Spirit + sugar + fresh herb (mint) + crushed ice, built in metal cup.
  Examples: Mint Julep, Chatham Artillery Punch (individual).

DESIGN PROCESS (use thinking mode):
1. Survey the user's pantry. Identify the strongest base spirit(s).
2. Pick a family that fits the pantry. If the pantry has egg white and citrus,
   lean sour or fizz. If spirit-forward with a bitter modifier, lean martini/OF.
   If sparkling, lean spritz.
3. Call search_recipes with the chosen family + one or two distinctive pantry
   ingredients to pull 2-3 reference recipes. Study their structure.
4. Design a new recipe that:
   - Follows the family's balance ratio (within ~20% tolerance)
   - Uses ONLY ingredients from the user's pantry (no exceptions)
   - Has 3-5 ingredients (not counting garnish and optional bitters)
   - Makes flavor sense: e.g. smoky + citrus + sweet works, smoky + cream does not
5. Name it. Good cocktail names reference a place, a person, a feeling, or the
   ingredients in a clever way. Avoid generic names ("Gin Drink #4"). Keep names
   under 4 words.
6. Specify method, glass, and garnish consistent with the family.
7. Write a 2-3 sentence "reasoning" explaining your choices — which family, why
   this balance, which reference recipes inspired the structure.

HARD CONSTRAINTS:
- Every ingredient_id in your output MUST appear in the user's pantry list provided
  in the user turn. The schema will reject anything else.
- Amounts are in milliliters. Standard measures: 45ml = 1.5oz pour, 30ml = 1oz,
  22ml = 0.75oz, 15ml = 0.5oz, 7ml = 1 tsp, 3ml = 2 dashes.
- Total liquid volume before dilution: 60-120ml for up drinks, 90-180ml for rocks,
  180-300ml for highballs/spritzes.
- Do not invent ingredients. Do not reference ingredients "to taste" — be specific.

OUTPUT SCHEMA:
{
  "name": "string, max 40 chars",
  "family": "sour|highball|old_fashioned|spritz|martini|flip|fizz|julep",
  "reasoning": "2-3 sentences, max 400 chars",
  "method": "shake|stir|build|blend|throw",
  "glass": "coupe|rocks|highball|martini|nick_and_nora|collins|wine",
  "garnish": "string, max 60 chars",
  "ingredients": [
    {
      "ingredient_id": "<MUST be from user's pantry>",
      "amount_ml": number between 1 and 180,
      "notes": "optional: 'muddled'|'top with'|'float'|'dry shake'|etc.",
      "position": integer, 1-indexed
    }
  ]
}

Return only the JSON object. No preamble, no postamble.
```

### Why this prompt works

- **Family grammar is explicit and quantitative.** The balance ratios give the model a template to fill rather than a blank page. Small models do much better with templates.
- **Process includes a tool call to pull references.** The model isn't generating from nothing — it sees 2-3 real recipes in the same family with overlapping ingredients, which massively improves output quality.
- **Hard constraints separate from soft guidance.** "Every ingredient_id must appear in the pantry" is a hard constraint enforced by the schema. "Good cocktail names reference a place..." is soft guidance. Keeping these separate prevents the model from treating style hints as blockers.
- **ml as the unit with a conversion cheat sheet.** Telling the model "use standard pours" doesn't work; giving it the actual numbers does.
- **Thinking mode is called out.** E2B's reasoning mode is materially better than its direct-answer mode for generation. The prompt invokes it explicitly.

### Post-generation validation (deterministic)

The JSON that comes back is schema-valid (constrained decoding ensures that) but may still be a *bad* recipe. Three checks run in TypeScript before showing to the user:

1. **Ratio check:** compute the sum of spirit ml vs citrus ml vs sweetener ml (using ingredient category). Compare against the declared family's expected ratio. Reject if off by >30%.
2. **Pantry check:** every `ingredient_id` must appear in `user_pantry`. This is redundant with constrained decoding but worth double-checking.
3. **Volume check:** total liquid volume must fall within the expected range for the glass type.

On rejection, retry up to 2 more times with the validation error fed back into the context as a user turn ("That recipe had X problem. Try again."). Most failures resolve on retry 1.

---

## 11. Open Questions and Risks

**Model download UX.** 1.2GB is a lot to ask on first launch. Options:
- Download on first use of LLM features only ("Unlock Invent Mode" CTA)
- Background download after install if on wifi
- Detect AICore and skip entirely where available

This is the single biggest adoption risk. Worth A/B testing the framing.

**Battery.** On-device inference is real draw. Mitigation: LLM only fires on explicit user actions (search button press, "invent" button), never on typing keystrokes or passive matching. Budget for ~5-10% battery impact per heavy session.

**Generation quality at E2B scale.** E2B is competent but not Gemini-Flash-level. Phase 4 will reveal how good generation actually is. If quality is unacceptable:
- Phase 5 fine-tune is the answer (LoRA on real recipes should yield meaningful gains)
- Interim fallback: cloud API for generation, on-device for everything else

**Device coverage.** Some older/budget Android phones won't run E2B acceptably. Plan: device allowlist based on RAM (>=6GB recommended) and Android version (>=12). Below threshold, hide LLM features entirely — app still works as a pure deterministic matcher.

**Ingredient normalization drift.** New recipes from CocktailDB will contain ingredient strings not in the alias map. The sync pipeline must flag these for manual review rather than silently dropping them or creating duplicate canonical entries. Build a small admin script that lists "new unrecognized ingredients" after each sync.

**Licensing.** CocktailDB Premium ($3) is fine. CocktailFYI is free. IBA data is public. HuggingFace datasets: check individual dataset licenses — some are CC-BY, some are scrape-based with ambiguous status. Avoid the ambiguous ones until legal story is clear.

---

## 12. Summary

Will It Cocktail is a three-layer product:

1. **Fast, deterministic, offline matcher** over a curated SQLite recipe corpus — this is the daily-driver loop.
2. **On-device Gemma 4 E2B** for fuzzy intent search and substitute reasoning — this makes the app feel smart.
3. **On-device recipe generation** grounded in cocktail family grammar — this is the differentiator.

Android-first with Capacitor keeps the stack web-native and the dev loop fast. SQLite shipped in the APK makes it genuinely offline. LiteRT-LM with constrained decoding makes on-device LLM output reliable enough for production. The backend is deferred until Phase 5 and remains simple when it arrives.

The core bet: a cocktail app that works instantly in an elevator, a kitchen, or a bar with dead wifi, and that can also invent a drink from your pantry, is more valuable than one that does either alone.
