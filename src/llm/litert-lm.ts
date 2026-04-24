import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import type { DataIndex } from '../data';
import { matchRecipes } from '../matcher';
import { RECIPE_TAGS, type FlavorTag } from '../data/flavor-tags';
import type { Recipe } from '../types';
import { useLitertLmConfig } from '../store/litertlm-config';
import type {
  IntentMatch,
  IntentSearchResult,
  InventedRecipe,
  LlmProvider,
  ParsedPantry,
  RecipePolish,
} from './provider';
import { check_pantry, search_recipes, type SearchRecipesArgs } from './tools';

// --- Native plugin surface --------------------------------------------------
// Implemented in Kotlin under android/app/src/main/java/.../LiteRtLmPlugin.kt.
// Deliberately kept narrow: single-shot `generate`, with multi-step workflows
// composed from TypeScript. Multi-turn tool loops are ugly on-device and the
// sessions blow the 8k context of Gemma 2B fast — chaining generate() calls
// with pre-filtered context is clearer and easier to debug.

export interface ModelStatus {
  downloaded: boolean;
  ready: boolean; // downloaded AND engine initialised
  path?: string;
  sizeBytes?: number;
  backend?: 'gpu' | 'cpu'; // set once engine is initialised
}

export interface DownloadProgressEvent {
  bytesDownloaded: number;
  totalBytes: number;
}

export interface GenerateOptions {
  prompt: string;
  maxTokens?: number;
  temperature?: number;
  topK?: number;
  // Not all LiteRT / MediaPipe GenAI builds support schema-constrained
  // decoding. When unsupported, the plugin ignores this and we fall back to
  // tolerant JSON parsing on the TS side.
  jsonSchema?: string;
}

export interface GenerateResult {
  text: string;
  tokenCount?: number;
  stopReason: 'stop' | 'length' | 'error';
  errorMessage?: string;
}

export interface DeviceModel {
  path: string;
  name: string;
  sizeBytes: number;
}

export interface ImportProgressEvent {
  bytesWritten: number;
  totalBytes: number;
}

export interface AiCoreStatusResult {
  status: 'available' | 'downloadable' | 'downloading' | 'unavailable';
  tokenLimit?: number;
  error?: string;
}

export interface LiteRtLmPlugin {
  modelStatus(): Promise<ModelStatus>;
  setModelConfig(opts: { url: string; expectedSha256?: string }): Promise<void>;
  downloadModel(): Promise<{ path: string }>;
  deleteModel(): Promise<void>;
  generate(opts: GenerateOptions): Promise<GenerateResult>;
  importModelFile(): Promise<{ path: string }>;
  importModelFromPath(opts: { path: string }): Promise<{ path: string }>;
  detectDeviceModels(): Promise<{ models: DeviceModel[] }>;
  hasAllFilesAccess(): Promise<{ granted: boolean }>;
  requestAllFilesAccess(): Promise<void>;
  /** Check whether AICore / Gemini Nano is available on this device. */
  aiCoreStatus(): Promise<AiCoreStatusResult>;
  /** Warm up the AICore model to reduce first-inference cold-start latency. */
  aiCoreWarmup(): Promise<void>;
  /** Run inference via AICore. Rejects if AICore is not available. */
  aiCoreGenerate(opts: { prompt: string; maxTokens?: number }): Promise<{ text: string; finishReason: string }>;
  addListener(
    eventName: 'downloadProgress',
    listenerFunc: (event: DownloadProgressEvent) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: 'importProgress',
    listenerFunc: (event: ImportProgressEvent) => void,
  ): Promise<PluginListenerHandle>;
}

const pluginRef: LiteRtLmPlugin | null = Capacitor.isNativePlatform()
  ? registerPlugin<LiteRtLmPlugin>('LiteRtLm')
  : null;

export function getLiteRtLmPlugin(): LiteRtLmPlugin | null {
  return pluginRef;
}

// --- Provider ---------------------------------------------------------------

export class LitertLmProvider implements LlmProvider {
  readonly id = 'litert-lm';
  readonly requiresModelDownload = true;

  // Set by isAvailable(); used by _generate() to route calls.
  // null = not yet checked, true = AICore ready, false = use local model.
  private aiCoreReady: boolean | null = null;

  get label(): string {
    return this.aiCoreReady ? 'On-device (AICore)' : 'On-device (Gemma)';
  }

  async isAvailable(): Promise<boolean> {
    const p = getLiteRtLmPlugin();
    if (!p) return false;

    // 1. Try AICore first (Pixel 9+). If available we can infer without any
    //    local model file, so we return true immediately and fire warmup.
    try {
      const acs = await p.aiCoreStatus();
      if (acs.status === 'available') {
        this.aiCoreReady = true;
        // Warmup in background — don't block isAvailable().
        void p.aiCoreWarmup();
        return true;
      }
      this.aiCoreReady = false;
    } catch {
      this.aiCoreReady = false;
    }

    // 2. Fall through to local model file (download or sideload path).
    try {
      const { modelUrl, expectedSha256 } = useLitertLmConfig.getState();
      if (modelUrl) {
        await p.setModelConfig({ url: modelUrl, expectedSha256: expectedSha256 || undefined });
      }
      const s = await p.modelStatus();
      return s.downloaded === true;
    } catch {
      return false;
    }
  }

  /**
   * Internal generate dispatcher. Tries AICore when available, falls back to
   * the local LiteRT model. On AICore the jsonSchema field is ignored (ML Kit
   * does not expose constrained decoding); the prompt text describes the
   * required JSON shape and safeJsonParse handles deviations.
   */
  private async _generate(opts: GenerateOptions): Promise<string> {
    const p = requirePlugin();
    if (this.aiCoreReady) {
      try {
        const r = await p.aiCoreGenerate({ prompt: opts.prompt, maxTokens: opts.maxTokens ?? 512 });
        return r.text;
      } catch {
        // AICore inference failed (e.g. model evicted from NPU, device too hot).
        // Session-sticky: fall through to local model for the rest of this
        // session. Transient failures won't self-heal, but this avoids repeated
        // failed attempts. User can re-open the app to retry AICore.
        this.aiCoreReady = false;
      }
    }
    const r = await p.generate(opts);
    return r.text;
  }

  async parseIngredients(input: string, data: DataIndex): Promise<ParsedPantry> {
    const vocab = sampleVocabulary(data, input);
    const prompt = buildParsePrompt(input, vocab);
    const text = await this._generate({ prompt, maxTokens: 1024, temperature: 0.1, jsonSchema: PARSE_SCHEMA });
    return mapParseOutput(safeJsonParse(text), data);
  }

  async searchIntent(
    query: string,
    pantryIds: string[],
    data: DataIndex,
  ): Promise<IntentSearchResult> {
    // Do the retrieval step in TS so the model only has to rank. Feeds a
    // pre-filtered candidate list of 8–12 recipes matched against pantry +
    // crude keyword tags — way faster than asking the 2B model to execute
    // search_recipes from scratch, and bounds the context size.
    const candidates = preselect(query, pantryIds, data);
    const prompt = buildIntentPrompt(query, pantryIds, candidates, data);
    const text = await this._generate({ prompt, maxTokens: 1280, temperature: 0.3, jsonSchema: INTENT_SCHEMA });
    return mapIntentOutput(safeJsonParse(text), data, pantryIds, candidates);
  }

  async proposeRecipe(candidate: Recipe, data: DataIndex): Promise<RecipePolish> {
    const prompt = buildPolishPrompt(candidate, data);
    const text = await this._generate({ prompt, maxTokens: 512, temperature: 0.7, jsonSchema: POLISH_SCHEMA });
    const parsed = safeJsonParse(text);
    return {
      name: sanitiseString(parsed?.name, candidate.name, 48),
      garnish: sanitiseString(parsed?.garnish, candidate.garnish ?? '—', 80),
      instructions: sanitiseString(parsed?.instructions, candidate.instructions, 400),
      reasoning: sanitiseString(parsed?.reasoning, '', 300),
    };
  }

  async inventFromPantry(
    query: string,
    pantryIds: string[],
    data: DataIndex,
  ): Promise<InventedRecipe[]> {
    const prompt = buildInventPrompt(query, pantryIds, data);
    const text = await this._generate({ prompt, maxTokens: 1536, temperature: 0.7, jsonSchema: INVENT_SCHEMA });
    return mapInventOutput(safeJsonParse(text), pantryIds, data);
  }
}

function requirePlugin(): LiteRtLmPlugin {
  const p = getLiteRtLmPlugin();
  if (!p) {
    throw new Error(
      'LiteRT-LM plugin is not installed. Build the Android app (see src/llm/README.md).',
    );
  }
  return p;
}

// --- Prompt builders --------------------------------------------------------

function buildParsePrompt(input: string, vocab: string): string {
  return [
    'You parse freeform cocktail ingredient phrases into canonical IDs.',
    '',
    `Canonical IDs (sample): ${vocab}.`,
    '',
    'Rules:',
    '- Pick the most generic applicable ID when the user is vague ("gin" → "gin", not a child brand).',
    '- confidence: 1.0 certain · 0.7 probable · 0.4 guess.',
    '- Put phrases you cannot map into "unresolved".',
    '',
    'Return ONLY a raw JSON object — no markdown, no code fences, no explanation:',
    '{ "resolved": [{ "input": string, "ingredient_id": string, "confidence": number }], "unresolved": [string] }',
    '',
    `User input: ${input}`,
    '',
    'JSON (no fences):',
  ].join('\n');
}

function buildIntentPrompt(
  query: string,
  pantryIds: string[],
  candidates: Recipe[],
  data: DataIndex,
): string {
  const pantryNames = pantryIds
    .map((id) => data.ingredientById.get(id)?.name ?? id)
    .join(', ');
  const candidateLines = candidates
    .map((r) => {
      const tags = RECIPE_TAGS[r.id] ?? [];
      return `- ${r.id} (${r.name}) — family=${r.family}${tags.length ? `, tags=[${tags.join(',')}]` : ''}`;
    })
    .join('\n');
  return [
    'You rank cocktails for a user based on their pantry and mood.',
    '',
    `Pantry: ${pantryNames || '(empty)'}`,
    `User query: ${query}`,
    '',
    'Candidate recipes (rank these — do not invent ids):',
    candidateLines,
    '',
    'Return ONLY a raw JSON object — no markdown, no code fences:',
    '{ "interpretation": string (≤12 words), "matches": [{ "recipe_id": string, "fit_reason": string (≤12 words) }], "notes": string (optional) }',
    'Pick 3–5 best. recipe_id MUST be copied exactly from the list above.',
    '',
    'JSON (no fences):',
  ].join('\n');
}

function buildPolishPrompt(candidate: Recipe, data: DataIndex): string {
  const ingredientLines = candidate.ingredients
    .map((ri) => {
      const name = data.ingredientById.get(ri.ingredientId)?.name ?? ri.ingredientId;
      return `- ${name}: ${ri.amountDisplay}${ri.notes ? ` (${ri.notes})` : ''}`;
    })
    .join('\n');
  return [
    'Polish a pre-structured cocktail recipe. The ingredients, amounts, glass, and method are FIXED — do not change them.',
    '',
    `Family: ${candidate.family} · Method: ${candidate.method} · Glass: ${candidate.glass}`,
    `Ingredients:\n${ingredientLines}`,
    `Current placeholder name: ${candidate.name}`,
    '',
    'Return ONLY a raw JSON object — no markdown, no code fences:',
    '{ "name": string (≤4 words, no "The" unless needed), "garnish": string (short phrase), "instructions": string (2-3 sentences), "reasoning": string (1 sentence) }',
    '',
    'JSON (no fences):',
  ].join('\n');
}

// --- Pre-selection ----------------------------------------------------------
// Grab a reasonable candidate pool the model can rank. Uses the existing
// pantry matcher as the spine, then pads with recent recipes of matching
// family if the pantry is sparse. Caps the list so the prompt stays small.

function preselect(query: string, pantryIds: string[], data: DataIndex): Recipe[] {
  const MAX = 10;
  const seen = new Set<string>();
  const out: Recipe[] = [];

  const pantryMatches = matchRecipes(pantryIds, {}, data);
  for (const m of pantryMatches) {
    if (out.length >= MAX) break;
    if (seen.has(m.recipe.id)) continue;
    seen.add(m.recipe.id);
    out.push(m.recipe);
  }

  if (out.length < MAX) {
    const q = query.toLowerCase();
    for (const r of data.recipes) {
      if (out.length >= MAX) break;
      if (seen.has(r.id)) continue;
      const hay = `${r.name} ${r.family} ${(RECIPE_TAGS[r.id] ?? []).join(' ')}`.toLowerCase();
      if (q && q.split(/\s+/).some((w) => w.length > 2 && hay.includes(w))) {
        seen.add(r.id);
        out.push(r);
      }
    }
  }

  // If still sparse, pad with IBA officials.
  if (out.length < 4) {
    const fallback: SearchRecipesArgs = { max_results: MAX };
    for (const hit of search_recipes(fallback, data)) {
      if (out.length >= MAX) break;
      const r = data.recipes.find((x) => x.id === hit.recipe_id);
      if (!r || seen.has(r.id)) continue;
      seen.add(r.id);
      out.push(r);
    }
  }

  return out;
}

// --- Output mapping ---------------------------------------------------------

function mapParseOutput(parsed: any, data: DataIndex): ParsedPantry {
  const resolvedRaw = Array.isArray(parsed?.resolved) ? parsed.resolved : [];
  const resolved = resolvedRaw
    .map((r: any) => {
      const id = String(r?.ingredient_id ?? '');
      const ing = data.ingredientById.get(id);
      if (!ing) return null;
      return {
        input: String(r?.input ?? ing.name),
        ingredientId: id,
        ingredientName: ing.name,
        confidence: typeof r?.confidence === 'number' ? r.confidence : 0.6,
      };
    })
    .filter((x: unknown): x is NonNullable<typeof x> => x !== null);

  // Dedupe by ingredient id.
  const seen = new Set<string>();
  const deduped = resolved.filter((r: { ingredientId: string }) => {
    if (seen.has(r.ingredientId)) return false;
    seen.add(r.ingredientId);
    return true;
  });
  return {
    resolved: deduped,
    unresolved: Array.isArray(parsed?.unresolved)
      ? parsed.unresolved.map((u: unknown) => String(u))
      : [],
  };
}

function mapIntentOutput(
  parsed: any,
  data: DataIndex,
  pantryIds: string[],
  candidates: Recipe[],
): IntentSearchResult {
  const candidateIds = new Set(candidates.map((r) => r.id));
  const pantryMatches = matchRecipes(pantryIds, {}, data);
  const matchByRecipe = new Map(pantryMatches.map((m) => [m.recipe.id, m]));

  const raw = Array.isArray(parsed?.matches) ? parsed.matches : [];
  const matches: IntentMatch[] = raw
    .map((m: any) => {
      const id = String(m?.recipe_id ?? '').trim();
      if (!candidateIds.has(id)) return null; // hallucinated id — drop
      const recipe = data.recipes.find((r) => r.id === id);
      if (!recipe) return null;
      const det = matchByRecipe.get(id);
      let makeability: IntentMatch['makeability'] = 'cannot_make';
      let substitutions: IntentMatch['substitutions'] = [];
      let missing: string[] = [];
      if (det) {
        if (det.tier === 'exact') makeability = 'now';
        else if (det.tier === 'near') makeability = 'with_substitute';
        else if (det.tier === 'almost') makeability = 'missing_one';
        substitutions = det.substitutions.map((s) => ({
          original: s.originalId,
          use: s.useId,
        }));
        missing = det.missing;
      } else {
        const needed = recipe.ingredients
          .filter((ri) => !ri.optional)
          .map((ri) => ri.ingredientId);
        const { missing: miss } = check_pantry(needed, pantryIds, data);
        missing = miss;
      }
      return {
        recipeId: id,
        recipeName: recipe.name,
        fitReason: String(m?.fit_reason ?? '').slice(0, 120),
        makeability,
        substitutions,
        missing,
        tags: (RECIPE_TAGS[id] ?? []) as FlavorTag[],
      };
    })
    .filter((x: IntentMatch | null): x is IntentMatch => x !== null);

  return {
    interpretation: String(parsed?.interpretation ?? '').slice(0, 120),
    matches,
    notes:
      typeof parsed?.notes === 'string' && parsed.notes.length
        ? String(parsed.notes).slice(0, 240)
        : undefined,
  };
}

// --- Helpers ---------------------------------------------------------------

function sampleVocabulary(data: DataIndex, input: string): string {
  // Prioritise ingredients whose name or ID shares a word with the input so
  // the model always sees the canonical ID for what the user typed, regardless
  // of DB insertion order. Fill remaining slots from the full list.
  const words = input.toLowerCase().split(/\W+/).filter((w) => w.length > 2);
  const seen = new Set<string>();
  const out: string[] = [];

  const fmt = (i: { id: string; name: string }) => `${i.id} (${i.name})`;

  // Pass 1: input-relevant ingredients
  for (const ing of data.ingredients) {
    const hay = `${ing.id} ${ing.name}`.toLowerCase();
    if (words.some((w) => hay.includes(w))) {
      seen.add(ing.id);
      out.push(fmt(ing));
    }
  }

  // Pass 2: also check aliases for relevance
  for (const alias of data.aliases) {
    if (seen.has(alias.ingredientId)) continue;
    const hay = alias.alias.toLowerCase();
    if (words.some((w) => hay.includes(w))) {
      const ing = data.ingredientById.get(alias.ingredientId);
      if (ing) {
        seen.add(ing.id);
        out.push(fmt(ing));
      }
    }
  }

  // Pass 3: pad up to 60 with general coverage
  for (const ing of data.ingredients) {
    if (out.length >= 60) break;
    if (!seen.has(ing.id)) {
      seen.add(ing.id);
      out.push(fmt(ing));
    }
  }

  return out.join(', ');
}

function sanitiseString(v: unknown, fallback: string, maxLen: number): string {
  const s = typeof v === 'string' ? v.trim() : '';
  if (!s) return fallback;
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

export function safeJsonParse(text: string): any {
  // Small LLMs wrap JSON in code fences, apologise before/after, or emit
  // trailing commas. Try a few progressively looser repairs before giving up.
  const direct = tryParse(text);
  if (direct !== undefined) return direct;

  // Strip Markdown fences.
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    const f = tryParse(fenced[1]);
    if (f !== undefined) return f;
  }

  // Extract the first balanced {...} block.
  const firstBrace = text.indexOf('{');
  if (firstBrace >= 0) {
    let depth = 0;
    for (let i = firstBrace; i < text.length; i++) {
      if (text[i] === '{') depth++;
      else if (text[i] === '}') {
        depth--;
        if (depth === 0) {
          const slice = text.slice(firstBrace, i + 1);
          const parsed = tryParse(slice) ?? tryParse(slice.replace(/,\s*([}\]])/g, '$1'));
          if (parsed !== undefined) return parsed;
          break;
        }
      }
    }
  }
  return null;
}

function tryParse(s: string): any | undefined {
  try {
    return JSON.parse(s);
  } catch {
    return undefined;
  }
}

// JSON schemas. Stringified so the plugin can forward them to MediaPipe's
// constrained-decoding API when available. When unsupported, the prompt itself
// gives the shape and safeJsonParse handles small deviations.

const PARSE_SCHEMA = JSON.stringify({
  type: 'object',
  properties: {
    resolved: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          input: { type: 'string' },
          ingredient_id: { type: 'string' },
          confidence: { type: 'number' },
        },
        required: ['input', 'ingredient_id', 'confidence'],
      },
    },
    unresolved: { type: 'array', items: { type: 'string' } },
  },
  required: ['resolved', 'unresolved'],
});

const INTENT_SCHEMA = JSON.stringify({
  type: 'object',
  properties: {
    interpretation: { type: 'string' },
    matches: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          recipe_id: { type: 'string' },
          fit_reason: { type: 'string' },
        },
        required: ['recipe_id', 'fit_reason'],
      },
    },
    notes: { type: 'string' },
  },
  required: ['interpretation', 'matches'],
});

const POLISH_SCHEMA = JSON.stringify({
  type: 'object',
  properties: {
    name: { type: 'string' },
    garnish: { type: 'string' },
    instructions: { type: 'string' },
    reasoning: { type: 'string' },
  },
  required: ['name', 'garnish', 'instructions', 'reasoning'],
});

// --- Invent prompt & schema -------------------------------------------------

function buildInventPrompt(query: string, pantryIds: string[], data: DataIndex): string {
  // List IDs only — showing the display name alongside confuses the model
  // into using the display name ("Fresh Basil") as the ingredient_id instead
  // of the canonical ID ("basil"), which then fails the ID lookup filter.
  const pantryLines = pantryIds
    .filter((id) => data.ingredientById.has(id))
    .join(', ');

  return [
    'You are a cocktail designer. Create 2 original cocktails using ONLY the ingredients listed in the pantry.',
    '',
    'COCKTAIL FAMILY RULES (pick the best fit):',
    '- SOUR: 45ml spirit + 22ml citrus + 22ml sweetener. Shaken. Coupe.',
    '- HIGHBALL: 45ml spirit + 120ml mixer. Built. Highball.',
    '- OLD_FASHIONED: 60ml spirit + 7ml sweetener + 2 dashes bitters. Stirred. Rocks.',
    '- MARTINI: 60ml spirit + 30ml modifier. Stirred. Coupe or martini.',
    '- SPRITZ: 90ml sparkling wine + 60ml bitter liqueur + splash soda. Built. Wine glass.',
    '- FIZZ: 45ml spirit + 22ml citrus + 22ml sweetener + soda top. Shaken then built. Highball.',
    '',
    `PANTRY: ${pantryLines}`,
    '',
    `REQUEST: ${query}`,
    '',
    'RULES:',
    '- Every ingredient_id MUST be copied exactly from the PANTRY list above.',
    '- Do not invent ingredients outside the pantry.',
    '- Amounts in ml. Use standard pours: 60=2oz, 45=1.5oz, 30=1oz, 22=0.75oz, 15=0.5oz.',
    '- 3-5 ingredients per drink (not counting garnish).',
    '- Name: 2-4 words, evocative, no generic names.',
    '',
    'Return ONLY a raw JSON array of 2 recipes — no markdown, no fences:',
    '[{"name":string,"family":"sour|highball|old_fashioned|martini|spritz|fizz|julep","method":"shake|stir|build","glass":"coupe|rocks|highball|martini|collins|wine","garnish":string,"instructions":string,"reasoning":string,"ingredients":[{"ingredient_id":string,"amount_ml":number}]}]',
    '',
    'JSON (no fences):',
  ].join('\n');
}

function mapInventOutput(parsed: any, pantryIds: string[], data: DataIndex): InventedRecipe[] {
  const pantrySet = new Set(pantryIds);
  const raw = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.recipes) ? parsed.recipes : []);
  const results: InventedRecipe[] = [];

  for (const r of raw) {
    if (!r || typeof r !== 'object') continue;

    const rawIngs = Array.isArray(r.ingredients) ? r.ingredients : [];
    const missing: string[] = [];
    const ingredients = rawIngs
      .map((ri: any, idx: number) => {
        const id = String(ri?.ingredient_id ?? '').trim();
        // Drop hallucinated IDs not in the canonical DB at all.
        if (!data.ingredientById.has(id)) return null;
        const amountMl = typeof ri?.amount_ml === 'number' ? ri.amount_ml : undefined;
        if (!pantrySet.has(id)) missing.push(id);
        return {
          ingredientId: id,
          amountDisplay: amountMl ? formatMlToOz(amountMl) : (ri?.amount_display ?? 'to taste'),
          amountMl,
          position: idx + 1,
        };
      })
      .filter((x: any): x is NonNullable<typeof x> => x !== null);

    if (ingredients.length < 2) continue;

    results.push({
      name: sanitiseString(r.name, 'Unnamed', 48),
      family: sanitiseString(r.family, 'sour', 20) as InventedRecipe['family'],
      method: sanitiseString(r.method, 'shake', 10) as InventedRecipe['method'],
      glass: sanitiseString(r.glass, 'coupe', 10) as InventedRecipe['glass'],
      garnish: sanitiseString(r.garnish, '', 80),
      instructions: sanitiseString(r.instructions, '', 400),
      reasoning: sanitiseString(r.reasoning, '', 300),
      ingredients,
      missing,
      alsoNeeded: [],
    });
  }

  return results;
}

function formatMlToOz(ml: number): string {
  const oz = ml / 30;
  const snapped = Math.round(oz * 4) / 4; // snap to nearest 0.25 oz
  if (snapped === Math.floor(snapped)) return `${snapped} oz`;
  return `${snapped} oz`;
}

const INVENT_SCHEMA = JSON.stringify({
  type: 'array',
  items: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      family: { type: 'string' },
      method: { type: 'string' },
      glass: { type: 'string' },
      garnish: { type: 'string' },
      instructions: { type: 'string' },
      reasoning: { type: 'string' },
      ingredients: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            ingredient_id: { type: 'string' },
            amount_ml: { type: 'number' },
          },
          required: ['ingredient_id', 'amount_ml'],
        },
      },
    },
    required: ['name', 'family', 'method', 'glass', 'instructions', 'ingredients'],
  },
});
