import type { DataIndex } from '../data';
import type { FlavorTag } from '../data/flavor-tags';
import type { Recipe } from '../types';
import type {
  IntentMatch,
  IntentSearchResult,
  InventedRecipe,
  LlmProvider,
  LlmRecipeDetails,
  ParsedPantry,
  RecipePolish,
} from './provider';
import type { CocktailFamily, Glass, Method } from '../types';
import type { CloudConfig } from './settings';
import {
  check_pantry,
  get_recipe,
  get_substitutes,
  search_recipes,
  type SearchRecipesArgs,
} from './tools';
import { matchRecipesMemo } from '../matcher';
import { RECIPE_TAGS } from '../data/flavor-tags';
import { sanitiseString, safeJsonParse } from './utils';

// --- Message / tool-call types (OpenAI-compatible) ---

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_call_id?: string;
  tool_calls?: ChatToolCall[];
  name?: string;
}

export interface ChatToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

// Shape of a single SSE chunk from /chat/completions (stream: true).
interface SSEChunk {
  choices?: Array<{
    delta?: {
      content?: string;
      tool_calls?: Array<{
        index: number;
        id?: string;
        function?: { name?: string; arguments?: string };
      }>;
    };
  }>;
}

// --- Tool schema for the model (JSON Schema shape) ---

export const TOOL_FUNCTIONS = [
  {
    type: 'function',
    function: {
      name: 'search_recipes',
      description:
        'Search the recipe database by required ingredients, cocktail family, and/or flavor tags.',
      parameters: {
        type: 'object',
        properties: {
          has_ingredients: {
            type: 'array',
            items: { type: 'string' },
            description: 'Canonical ingredient IDs that must be present (hierarchy-aware).',
          },
          family: {
            type: 'string',
            enum: ['sour', 'highball', 'old_fashioned', 'spritz', 'martini', 'flip', 'fizz', 'julep', 'other'],
          },
          flavor_tags: {
            type: 'array',
            items: {
              type: 'string',
              enum: ['refreshing', 'herbaceous', 'citrus', 'smoky', 'bitter', 'sweet', 'spirit_forward', 'creamy', 'tropical', 'spicy'],
            },
          },
          max_results: { type: 'integer', minimum: 1, maximum: 20 },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_recipe',
      description: 'Fetch full details for a single recipe. Use before citing specific ingredients or instructions.',
      parameters: {
        type: 'object',
        properties: { recipe_id: { type: 'string' } },
        required: ['recipe_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_substitutes',
      description: 'Get ranked substitutes for an ingredient.',
      parameters: {
        type: 'object',
        properties: { ingredient_id: { type: 'string' } },
        required: ['ingredient_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'check_pantry',
      description: 'Check which of a list of ingredient IDs are covered by the user\'s pantry (hierarchy-aware).',
      parameters: {
        type: 'object',
        properties: {
          ingredient_ids: { type: 'array', items: { type: 'string' } },
        },
        required: ['ingredient_ids'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'finalize_pantry',
      description:
        'Call exactly once to return your final pantry parse. Stop after this call.',
      parameters: {
        type: 'object',
        properties: {
          resolved: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                input: { type: 'string', description: 'The original phrase from user input' },
                ingredient_id: { type: 'string' },
                confidence: { type: 'number', minimum: 0, maximum: 1 },
              },
              required: ['input', 'ingredient_id', 'confidence'],
            },
          },
          unresolved: { type: 'array', items: { type: 'string' } },
        },
        required: ['resolved', 'unresolved'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'finalize_intent',
      description:
        'Call exactly once to return your final ranked recipe matches. Stop after this call.',
      parameters: {
        type: 'object',
        properties: {
          interpretation: {
            type: 'string',
            description: 'One-line restatement of what the user wants.',
          },
          matches: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                recipe_id: { type: 'string' },
                fit_reason: { type: 'string', description: 'One short phrase explaining why this fits.' },
                recipe_name: { type: 'string', description: 'Human-readable name — required when recipe_id is not in the database.' },
                description: { type: 'string', description: 'One-sentence description of the drink — required when recipe_id is not in the database.' },
              },
              required: ['recipe_id', 'fit_reason'],
            },
          },
          notes: { type: 'string' },
        },
        required: ['interpretation', 'matches'],
      },
    },
  },
] as const;

// --- Provider ---

export interface OpenAiCompatOptions {
  config: CloudConfig;
  onToken?: (tok: string) => void; // streamed content deltas (not tool calls)
  onToolCall?: (name: string, args: string) => void;
  signal?: AbortSignal;
}

export class OpenAiCompatProvider implements LlmProvider {
  readonly id = 'openai-compat';
  readonly label = 'Cloud LLM';
  readonly requiresModelDownload = false;

  constructor(private opts: OpenAiCompatOptions) {}

  async isAvailable(): Promise<boolean> {
    const { baseUrl, model, apiKey } = this.opts.config;
    return Boolean(baseUrl && model && apiKey);
  }

  async parseIngredients(input: string, data: DataIndex): Promise<ParsedPantry> {
    const system = buildParseSystem(data);
    const messages: ChatMessage[] = [
      { role: 'system', content: system },
      { role: 'user', content: `Parse these ingredients: ${input}` },
    ];
    const final = await this.runToolLoop(messages, data, [], 'finalize_pantry');
    return mapFinalizePantry(final, data);
  }

  async proposeRecipe(candidate: Recipe, data: DataIndex): Promise<RecipePolish> {
    return sharedProposeRecipe(candidate, data, (msgs) => this.completeJson(msgs));
  }

  async getLlmRecipeDetails(name: string): Promise<LlmRecipeDetails | null> {
    return sharedGetLlmRecipeDetails(name, (msgs) => this.completeJson(msgs));
  }

  private async completeJson(messages: ChatMessage[]): Promise<Record<string, unknown>> {
    const { baseUrl, model, apiKey } = this.opts.config;
    const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      signal: this.opts.signal,
      body: JSON.stringify({
        model,
        temperature: 0.7,
        stream: false,
        messages,
        response_format: { type: 'json_object' },
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`LLM polish failed: ${res.status} ${res.statusText} ${text.slice(0, 200)}`);
    }
    const body = await res.json();
    const content: string = body?.choices?.[0]?.message?.content ?? '{}';
    try {
      return JSON.parse(content) as Record<string, unknown>;
    } catch {
      return {};
    }
  }

  async inventFromPantry(
    query: string,
    pantryIds: string[],
    data: DataIndex,
  ): Promise<InventedRecipe[]> {
    return sharedInventFromPantry(query, pantryIds, data, (msgs) => this.completeJson(msgs));
  }

  async searchIntent(
    query: string,
    pantryIds: string[],
    data: DataIndex,
  ): Promise<IntentSearchResult> {
    const system = buildIntentSystem(data, pantryIds);
    const messages: ChatMessage[] = [
      { role: 'system', content: system },
      { role: 'user', content: query },
    ];
    const final = await this.runToolLoop(messages, data, pantryIds, 'finalize_intent');
    return mapFinalizeIntent(final, data, pantryIds);
  }

  // --- Core tool loop ---

  private async runToolLoop(
    messages: ChatMessage[],
    data: DataIndex,
    pantryIds: string[],
    terminator: 'finalize_pantry' | 'finalize_intent',
  ): Promise<{ name: string; args: unknown }> {
    const maxIterations = 6;
    for (let i = 0; i < maxIterations; i++) {
      const { content, toolCalls } = await this.streamCompletion(messages);

      // Push assistant turn
      messages.push({
        role: 'assistant',
        content: content || null,
        tool_calls: toolCalls.length ? toolCalls : undefined,
      });

      if (toolCalls.length === 0) {
        // Model answered without terminator. Coerce it to finalize.
        messages.push({
          role: 'user',
          content: `Please call ${terminator} with your answer now.`,
        });
        continue;
      }

      for (const call of toolCalls) {
        this.opts.onToolCall?.(call.function.name, call.function.arguments);
        if (call.function.name === terminator) {
          const args = safeJsonParse(call.function.arguments);
          return { name: call.function.name, args };
        }
        const result = executeTool(call.function.name, call.function.arguments, data, pantryIds);
        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify(result),
        });
      }
    }
    throw new Error(`Cloud LLM did not call ${terminator} within ${maxIterations} iterations.`);
  }

  // --- Streaming HTTP ---

  private async streamCompletion(
    messages: ChatMessage[],
  ): Promise<{ content: string; toolCalls: ChatToolCall[] }> {
    const { baseUrl, model, apiKey } = this.opts.config;
    const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      signal: this.opts.signal,
      body: JSON.stringify({
        model,
        stream: true,
        temperature: 0.3,
        messages,
        tools: TOOL_FUNCTIONS,
        tool_choice: 'auto',
      }),
    });

    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => '');
      throw new Error(`LLM request failed: ${res.status} ${res.statusText} ${text.slice(0, 300)}`);
    }

    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = '';
    let content = '';
    const toolCallsBuilder = new Map<number, ChatToolCall>();

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += value;

      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const raw of lines) {
        const line = raw.trim();
        if (!line || !line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (payload === '[DONE]') continue;

        let chunk: SSEChunk;
        try {
          chunk = JSON.parse(payload) as SSEChunk;
        } catch {
          continue;
        }
        const delta = chunk.choices?.[0]?.delta;
        if (!delta) continue;

        if (typeof delta.content === 'string' && delta.content.length) {
          content += delta.content;
          this.opts.onToken?.(delta.content);
        }

        if (Array.isArray(delta.tool_calls)) {
          for (const tc of delta.tool_calls) {
            const idx = typeof tc.index === 'number' ? tc.index : 0;
            const existing = toolCallsBuilder.get(idx) ?? {
              id: tc.id ?? `call_${idx}`,
              type: 'function' as const,
              function: { name: '', arguments: '' },
            };
            if (tc.id) existing.id = tc.id;
            if (tc.function?.name) existing.function.name += tc.function.name;
            if (tc.function?.arguments) existing.function.arguments += tc.function.arguments;
            toolCallsBuilder.set(idx, existing);
          }
        }
      }
    }

    const toolCalls = Array.from(toolCallsBuilder.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([, v]) => v);

    return { content, toolCalls };
  }
}

// --- Tool dispatch ---

export function executeTool(
  name: string,
  argsJson: string,
  data: DataIndex,
  pantryIds: string[],
): unknown {
  const args = safeJsonParse(argsJson) as Record<string, unknown>;
  switch (name) {
    case 'search_recipes':
      return search_recipes(args as SearchRecipesArgs, data);
    case 'get_recipe':
      return get_recipe(String(args.recipe_id), data);
    case 'get_substitutes':
      return get_substitutes(String(args.ingredient_id), data);
    case 'check_pantry':
      return check_pantry((args.ingredient_ids as string[]) ?? [], pantryIds, data);
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

export { sanitiseString, safeJsonParse } from './utils';

// --- Shared provider methods ------------------------------------------------
// proposeRecipe, getLlmRecipeDetails, and inventFromPantry are identical across
// OpenAiCompatProvider and AnthropicProvider (only the HTTP transport differs).
// Both providers delegate to these functions, passing their completeJson as a
// callback so the business logic lives in exactly one place.

export async function sharedProposeRecipe(
  candidate: Recipe,
  data: DataIndex,
  completeJson: (messages: ChatMessage[]) => Promise<Record<string, unknown>>,
): Promise<RecipePolish> {
  const ingredientLines = candidate.ingredients
    .map((ri) => {
      const name = data.ingredientById.get(ri.ingredientId)?.name ?? ri.ingredientId;
      return `- ${name}: ${ri.amountDisplay}${ri.notes ? ` (${ri.notes})` : ''}`;
    })
    .join('\n');
  const system = [
    'You polish a pre-structured cocktail recipe. The ingredients, amounts, glass, and method are fixed — you must NOT change them.',
    'Return strict JSON with keys: name (max 4 words, no quotes, no "The" unless needed), garnish (short phrase), instructions (2-3 sentences), reasoning (1 sentence on why this works).',
    'Return ONLY the JSON object, no preamble.',
  ].join(' ');
  const user = [
    `Family: ${candidate.family}`,
    `Method: ${candidate.method}, Glass: ${candidate.glass}`,
    `Ingredients:\n${ingredientLines}`,
    `Current placeholder name: ${candidate.name}`,
    `Invent a better name and write proper instructions.`,
  ].join('\n');
  const raw = await completeJson([
    { role: 'system', content: system },
    { role: 'user', content: user },
  ]);
  return {
    name: sanitiseString(raw.name, candidate.name, 48),
    garnish: sanitiseString(raw.garnish, candidate.garnish ?? '—', 80),
    instructions: sanitiseString(raw.instructions, candidate.instructions, 400),
    reasoning: sanitiseString(raw.reasoning, '', 300),
  };
}

export async function sharedGetLlmRecipeDetails(
  name: string,
  completeJson: (messages: ChatMessage[]) => Promise<Record<string, unknown>>,
): Promise<LlmRecipeDetails | null> {
  const system = [
    'You are a cocktail expert. Return a JSON recipe for the requested drink.',
    'Keys: ingredients (array of {name: string, amount: string}), instructions (2-3 sentences), garnish (short phrase or null), glass (glass type).',
    'Use standard bartender amounts (oz or dashes). Return ONLY the JSON object, no preamble.',
  ].join(' ');
  try {
    const raw = await completeJson([
      { role: 'system', content: system },
      { role: 'user', content: `Recipe for: ${name}` },
    ]);
    const ings = Array.isArray(raw.ingredients)
      ? (raw.ingredients as unknown[])
          .filter((i): i is { name: unknown; amount: unknown } => typeof i === 'object' && i !== null)
          .map((i) => ({ name: String(i.name ?? ''), amount: String(i.amount ?? '') }))
          .filter((i) => i.name)
      : [];
    if (ings.length === 0) return null;
    return {
      ingredients: ings,
      instructions: sanitiseString(raw.instructions, '', 600),
      garnish: raw.garnish ? sanitiseString(raw.garnish, '', 80) : undefined,
      glass: raw.glass ? sanitiseString(raw.glass, '', 60) : undefined,
    };
  } catch {
    return null;
  }
}

export async function sharedInventFromPantry(
  query: string,
  pantryIds: string[],
  data: DataIndex,
  completeJson: (messages: ChatMessage[]) => Promise<Record<string, unknown>>,
): Promise<InventedRecipe[]> {
  if (pantryIds.length === 0) return [];
  const pantryLines = pantryIds
    .map((id) => data.ingredientById.get(id)?.name ?? id)
    .join(', ');
  const system = [
    'You are a cocktail inventor. Design 2-3 original cocktails from the user\'s pantry.',
    'Follow family balance: sour=2oz spirit:1oz citrus:0.75oz sweetener, old_fashioned=2oz spirit+bitters+sugar, highball=1.5oz spirit+4oz mixer, martini=2oz spirit+0.75oz modifier.',
    'Use primarily pantry ingredients (ingredientId must be from the pantry list).',
    'You MAY add up to 2 extra items per drink in "alsoNeeded" as free-text strings (e.g. "2 dashes cardamom bitters", "fresh basil leaf") — these are suggestions outside the pantry.',
    'Names: max 4 words, distinctive, no generic names.',
    'Return ONLY JSON: { "inventions": [ { name, family, method, glass, garnish, instructions, reasoning, ingredients: [{ingredientId, amountDisplay, amountMl, position}], alsoNeeded: [] } ] }',
    `Valid family: sour|highball|old_fashioned|spritz|martini|flip|fizz|julep|other`,
    `Valid method: shake|stir|build|blend|throw`,
    `Valid glass: coupe|rocks|highball|collins|martini|nick_and_nora|wine|flute|julep|hurricane`,
    `Pantry ingredient IDs: ${pantryIds.join(', ')}`,
  ].join(' ');
  const user = `Pantry: ${pantryLines}\n\nRequest: ${query.trim() || 'Invent something interesting.'}`;
  try {
    const raw = await completeJson([
      { role: 'system', content: system },
      { role: 'user', content: user },
    ]);
    const arr = Array.isArray(raw.inventions) ? raw.inventions : [];
    return arr
      .filter((x): x is Record<string, unknown> => typeof x === 'object' && x !== null)
      .map((x) => parseInventedRecipe(x, pantryIds, data))
      .filter((x): x is InventedRecipe => x !== null);
  } catch {
    return [];
  }
}

// --- System prompts ---

// Memoized by DataIndex instance: the full ingredient ID list is deterministic
// for a given data snapshot and can be expensive to rebuild (hundreds of IDs).
const _parseSystemCache = new WeakMap<object, string>();

export function buildParseSystem(data: DataIndex): string {
  const cached = _parseSystemCache.get(data);
  if (cached) return cached;
  const allIds = data.ingredients.map((i) => `${i.id} (${i.name})`).join(', ');
  const result = [
    'You help parse freeform ingredient lists into canonical ingredient IDs for a cocktail app.',
    'Call search_recipes / get_recipe only if you need to verify an ID.',
    `Full canonical ID list: ${allIds}.`,
    'When unsure which variant the user means (e.g. "gin" vs "london dry gin"), pick the most generic applicable ID.',
    'Confidence: 1.0 = certain; 0.7 = probable; 0.4 = guess. Put unparseable phrases in "unresolved".',
    'Always finish by calling finalize_pantry exactly once.',
  ].join(' ');
  _parseSystemCache.set(data, result);
  return result;
}

export function buildIntentSystem(data: DataIndex, pantryIds: string[]): string {
  const pantryNames = pantryIds
    .map((id) => data.ingredientById.get(id)?.name ?? id)
    .join(', ');
  return [
    'You help users discover cocktails that match what they are in the mood for.',
    `The user's pantry: ${pantryNames || '(empty)'}.`,
    'Workflow:',
    '1) Call search_recipes at least once (by flavor_tags, family, or ingredients) to get candidate recipes.',
    '2) Optionally call get_recipe on the top candidates.',
    '3) Call finalize_intent with 3-5 ranked matches.',
    'Prefer recipe_id values copied exactly from search_recipes results (snake_case like "negroni"). If no DB result fits well, you may suggest an unlisted recipe by setting recipe_id to a snake_case slug, recipe_name to the display name, and description to a one-sentence summary — the app will flag it as AI-generated.',
    'Prefer cocktails the user can make now, but also suggest close misses (one substitution or one missing ingredient). Do not return an empty matches array.',
    'Keep interpretations and fit_reason short (≤ 12 words).',
  ].join(' ');
}

// --- Mapping model output → typed results ---

export function mapFinalizePantry(
  final: { name: string; args: unknown },
  data: DataIndex,
): ParsedPantry {
  const args = (final.args ?? {}) as { resolved?: any[]; unresolved?: any[] };
  const resolved = (args.resolved ?? [])
    .map((r) => {
      const id = String(r?.ingredient_id ?? '');
      const ing = data.ingredientById.get(id);
      if (!ing) return null;
      return {
        input: String(r?.input ?? ing.name),
        ingredientId: id,
        ingredientName: ing.name,
        confidence: typeof r?.confidence === 'number' ? r.confidence : 0.7,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
  // Dedupe
  const seen = new Set<string>();
  const deduped = resolved.filter((r) => {
    if (seen.has(r.ingredientId)) return false;
    seen.add(r.ingredientId);
    return true;
  });
  return {
    resolved: deduped,
    unresolved: (args.unresolved ?? []).map((u: unknown) => String(u)),
  };
}

function resolveRecipeId(raw: unknown, data: DataIndex): string | null {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  // Exact ID (O(1) via recipeById)
  if (data.recipeById.has(s)) return s;
  // snake_case normalise
  const normalised = s.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
  if (data.recipeById.has(normalised)) return normalised;
  // Name match (case-insensitive) — still O(n) but rare
  const sLower = s.toLowerCase();
  const byName = data.recipes.find((r) => r.name.toLowerCase() === sLower);
  if (byName) return byName.id;
  // Partial name match (rare fallback)
  const partial = data.recipes.find(
    (r) => r.name.toLowerCase().includes(sLower) || sLower.includes(r.name.toLowerCase()),
  );
  return partial?.id ?? null;
}

export function mapFinalizeIntent(
  final: { name: string; args: unknown },
  data: DataIndex,
  pantryIds: string[],
): IntentSearchResult {
  const args = (final.args ?? {}) as {
    interpretation?: string;
    matches?: any[];
    notes?: string;
  };

  const deterministicMatches = matchRecipesMemo(pantryIds, data);
  const matchByRecipe = new Map(deterministicMatches.map((m) => [m.recipe.id, m]));

  const rawMatches = args.matches ?? [];
  let hasLlmGenerated = false;
  const matches: IntentMatch[] = [];
  for (const m of rawMatches) {
    const rawId = m?.recipe_id;
    const id = resolveRecipeId(rawId, data);
    const recipe = id ? data.recipeById.get(id) : null;

    if (!recipe || !id) {
      // Recipe not in DB — surface as an LLM-generated suggestion if the model gave us a name.
      const rawName = String(m?.recipe_name ?? rawId ?? '').trim();
      // Convert snake_case IDs to Title Case when no display name was provided.
      const name = m?.recipe_name
        ? rawName
        : rawName.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
      if (!name) continue;
      hasLlmGenerated = true;
      matches.push({
        recipeId: String(rawId ?? name),
        recipeName: name,
        fitReason: String(m?.fit_reason ?? ''),
        makeability: 'cannot_make',
        substitutions: [],
        missing: [],
        tags: [],
        llmGenerated: true,
        llmDescription: m?.description ? String(m.description) : undefined,
      });
      continue;
    }

    const det = matchByRecipe.get(id);
    let makeability: IntentMatch['makeability'] = 'cannot_make';
    let substitutions: IntentMatch['substitutions'] = [];
    let missing: string[] = [];
    if (det) {
      if (det.tier === 'exact') makeability = 'now';
      else if (det.tier === 'near') makeability = 'with_substitute';
      else if (det.tier === 'almost') makeability = 'missing_one';
      substitutions = det.substitutions.map((s) => ({ original: s.originalId, use: s.useId }));
      missing = det.missing;
    } else {
      const needed = recipe.ingredients.filter((ri) => !ri.optional).map((ri) => ri.ingredientId);
      const { missing: miss } = check_pantry(needed, pantryIds, data);
      missing = miss;
    }
    matches.push({
      recipeId: id,
      recipeName: recipe.name,
      fitReason: String(m?.fit_reason ?? ''),
      makeability,
      substitutions,
      missing,
      tags: (RECIPE_TAGS[id] ?? []) as FlavorTag[],
    });
  }

  const noteParts: string[] = [];
  if (args.notes) noteParts.push(String(args.notes));
  if (hasLlmGenerated) {
    noteParts.push('Some suggestions below are AI-generated and not in our recipe database — treat ingredients and quantities as a starting point.');
  }

  return {
    interpretation: String(args.interpretation ?? ''),
    matches,
    notes: noteParts.length ? noteParts.join(' · ') : undefined,
  };
}

export function parseInventedRecipe(
  raw: Record<string, unknown>,
  pantryIds: string[],
  data: DataIndex,
): InventedRecipe | null {
  const name = typeof raw.name === 'string' ? raw.name.trim() : '';
  if (!name) return null;

  const FAMILIES = new Set(['sour','highball','old_fashioned','spritz','martini','flip','fizz','julep','other']);
  const METHODS  = new Set(['shake','stir','build','blend','throw']);
  const GLASSES  = new Set(['coupe','rocks','highball','collins','martini','nick_and_nora','wine','flute','julep','hurricane']);

  const family  = FAMILIES.has(String(raw.family))  ? String(raw.family) as CocktailFamily : 'other';
  const method  = METHODS.has(String(raw.method))   ? String(raw.method) as Method         : 'shake';
  const glass   = GLASSES.has(String(raw.glass))    ? String(raw.glass) as Glass           : 'coupe';

  const pantrySet = new Set(pantryIds);
  const missing: string[] = [];
  const ingredients = (Array.isArray(raw.ingredients) ? raw.ingredients : [])
    .filter((i): i is Record<string, unknown> => typeof i === 'object' && i !== null)
    .filter((i) => typeof i.ingredientId === 'string' && data.ingredientById.has(i.ingredientId as string))
    .map((i, idx) => {
      const id = i.ingredientId as string;
      if (!pantrySet.has(id)) missing.push(id);
      return {
        ingredientId: id,
        amountDisplay: String(i.amountDisplay ?? ''),
        amountMl: typeof i.amountMl === 'number' ? i.amountMl : undefined,
        position: typeof i.position === 'number' ? i.position : idx + 1,
      };
    });

  if (ingredients.length < 2) return null;

  const alsoNeeded = (Array.isArray(raw.alsoNeeded) ? raw.alsoNeeded : [])
    .filter((s): s is string => typeof s === 'string' && s.trim().length > 0);

  return {
    name,
    family,
    method,
    glass,
    garnish: typeof raw.garnish === 'string' && raw.garnish ? raw.garnish : undefined,
    instructions: sanitiseString(raw.instructions, '', 600),
    reasoning: typeof raw.reasoning === 'string' ? raw.reasoning : undefined,
    ingredients,
    missing,
    alsoNeeded,
  };
}
