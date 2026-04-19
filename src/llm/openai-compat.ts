import type { DataIndex } from '../data';
import type { FlavorTag } from '../data/flavor-tags';
import type { Recipe } from '../types';
import type {
  IntentMatch,
  IntentSearchResult,
  LlmProvider,
  ParsedPantry,
  RecipePolish,
} from './provider';
import type { CloudConfig } from './settings';
import {
  check_pantry,
  get_recipe,
  get_substitutes,
  search_recipes,
  type SearchRecipesArgs,
} from './tools';
import { matchRecipes } from '../matcher';
import { RECIPE_TAGS } from '../data/flavor-tags';

// --- Message / tool-call types (OpenAI-compatible) ---

interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_call_id?: string;
  tool_calls?: ChatToolCall[];
  name?: string;
}

interface ChatToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

// --- Tool schema for the model (JSON Schema shape) ---

const TOOL_FUNCTIONS = [
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
    const raw = await this.completeJson([
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

        let chunk: any;
        try {
          chunk = JSON.parse(payload);
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

function executeTool(
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

function sanitiseString(v: unknown, fallback: string, maxLen: number): string {
  const s = typeof v === 'string' ? v.trim() : '';
  if (!s) return fallback;
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

function safeJsonParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}

// --- System prompts ---

function buildParseSystem(data: DataIndex): string {
  const sample = data.ingredients.slice(0, 30).map((i) => `${i.id} (${i.name})`).join(', ');
  return [
    'You help parse freeform ingredient lists into canonical ingredient IDs for a cocktail app.',
    'Call search_recipes / get_recipe only if you need to check an ingredient ID exists.',
    `Example canonical IDs: ${sample}, ... (see data for full list).`,
    'When unsure which variant the user means (e.g. "gin" vs "london dry gin"), pick the most generic applicable ID.',
    'Confidence: 1.0 = certain; 0.7 = probable; 0.4 = guess. Put unparseable phrases in "unresolved".',
    'Always finish by calling finalize_pantry exactly once.',
  ].join(' ');
}

function buildIntentSystem(data: DataIndex, pantryIds: string[]): string {
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
    'CRITICAL: recipe_id values in finalize_intent MUST be copied exactly from search_recipes results — they are snake_case ids like "negroni", "dry_martini", "old_fashioned". Never invent ids or use display names like "Negroni".',
    'Prefer cocktails the user can make now, but also suggest close misses (one substitution or one missing ingredient). Do not return an empty matches array.',
    'Keep interpretations and fit_reason short (≤ 12 words).',
  ].join(' ');
}

// --- Mapping model output → typed results ---

function mapFinalizePantry(
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
  // Exact ID
  if (data.recipes.some((r) => r.id === s)) return s;
  // snake_case normalise
  const normalised = s.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
  if (data.recipes.some((r) => r.id === normalised)) return normalised;
  // Name match (case-insensitive)
  const byName = data.recipes.find((r) => r.name.toLowerCase() === s.toLowerCase());
  if (byName) return byName.id;
  // Partial name match (rare fallback)
  const partial = data.recipes.find(
    (r) => r.name.toLowerCase().includes(s.toLowerCase()) || s.toLowerCase().includes(r.name.toLowerCase()),
  );
  return partial?.id ?? null;
}

function mapFinalizeIntent(
  final: { name: string; args: unknown },
  data: DataIndex,
  pantryIds: string[],
): IntentSearchResult {
  const args = (final.args ?? {}) as {
    interpretation?: string;
    matches?: any[];
    notes?: string;
  };

  const deterministicMatches = matchRecipes(pantryIds, {}, data);
  const matchByRecipe = new Map(deterministicMatches.map((m) => [m.recipe.id, m]));

  const rawMatches = args.matches ?? [];
  const unmatchedIds: string[] = [];
  const matches: IntentMatch[] = rawMatches
    .map((m) => {
      const rawId = m?.recipe_id;
      const id = resolveRecipeId(rawId, data);
      const recipe = id ? data.recipes.find((r) => r.id === id) : null;
      if (!recipe || !id) {
        if (rawId != null) unmatchedIds.push(String(rawId));
        return null;
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
      return {
        recipeId: id,
        recipeName: recipe.name,
        fitReason: String(m?.fit_reason ?? ''),
        makeability,
        substitutions,
        missing,
        tags: (RECIPE_TAGS[id] ?? []) as FlavorTag[],
      };
    })
    .filter((x): x is IntentMatch => x !== null);

  const noteParts: string[] = [];
  if (args.notes) noteParts.push(String(args.notes));
  if (unmatchedIds.length > 0) {
    noteParts.push(`Dropped unknown recipe ids: ${unmatchedIds.join(', ')}`);
  }
  if (rawMatches.length > 0 && matches.length === 0) {
    // Everything the model returned was unresolvable — fall back to a helpful signal.
    noteParts.push('The model suggested recipes not in our database. Try rephrasing, or switch to the heuristic provider.');
  }

  return {
    interpretation: String(args.interpretation ?? ''),
    matches,
    notes: noteParts.length ? noteParts.join(' · ') : undefined,
  };
}
