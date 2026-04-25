import type { DataIndex } from '../data';
import type { Recipe } from '../types';
import type {
  IntentSearchResult,
  InventedRecipe,
  LlmProvider,
  LlmRecipeDetails,
  ParsedPantry,
  RecipePolish,
} from './provider';
import type { CloudConfig } from './settings';
import {
  type ChatMessage,
  type ChatToolCall,
  TOOL_FUNCTIONS,
  buildParseSystem,
  buildIntentSystem,
  mapFinalizePantry,
  mapFinalizeIntent,
  executeTool,
  sanitiseString,
  parseInventedRecipe,
} from './openai-compat';

// --- Anthropic tool schema conversion ----------------------------------------
// Anthropic tools use `input_schema` instead of OpenAI's `parameters`, and the
// wrapper `{ type: 'function', function: {...} }` envelope is dropped.

interface AnthropicTool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

const ANTHROPIC_TOOLS: AnthropicTool[] = TOOL_FUNCTIONS.map((tf) => ({
  name: tf.function.name,
  description: tf.function.description as string,
  input_schema: tf.function.parameters as unknown as Record<string, unknown>,
}));

// --- Anthropic message types --------------------------------------------------
// Anthropic's content can be a string OR an array of typed blocks.

type AnthropicContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: string };

interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string | AnthropicContentBlock[];
}

// --- SSE event types ----------------------------------------------------------

interface AnthropicSSEEvent {
  type: string;
  index?: number;
  content_block?: {
    type: 'text' | 'tool_use';
    text?: string;
    id?: string;
    name?: string;
  };
  delta?: {
    type: 'text_delta' | 'input_json_delta' | string;
    text?: string;
    partial_json?: string;
  };
}

// --- Message conversion: internal OpenAI format → Anthropic wire format ------

function safeParseObject(s: string): Record<string, unknown> {
  try {
    const v = JSON.parse(s);
    return typeof v === 'object' && v !== null && !Array.isArray(v)
      ? (v as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function toAnthropicPayload(messages: ChatMessage[]): {
  system: string;
  messages: AnthropicMessage[];
} {
  let system = '';
  const result: AnthropicMessage[] = [];

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]!;

    if (msg.role === 'system') {
      system = msg.content ?? '';
      continue;
    }

    if (msg.role === 'user') {
      result.push({ role: 'user', content: msg.content ?? '' });
      continue;
    }

    if (msg.role === 'assistant') {
      if (msg.tool_calls?.length) {
        const content: AnthropicContentBlock[] = [];
        // Anthropic accepts optional text before tool_use blocks.
        if (msg.content) content.push({ type: 'text', text: msg.content });
        for (const tc of msg.tool_calls) {
          content.push({
            type: 'tool_use',
            id: tc.id,
            name: tc.function.name,
            // Anthropic wants the parsed object, not a JSON string.
            input: safeParseObject(tc.function.arguments),
          });
        }
        result.push({ role: 'assistant', content });
      } else {
        result.push({ role: 'assistant', content: msg.content ?? '' });
      }
      continue;
    }

    if (msg.role === 'tool') {
      // Batch all consecutive tool-result messages into a single user turn.
      // Anthropic requires all tool_result blocks for a given assistant turn to
      // arrive together; OpenAI sends one `tool` message per call.
      const toolResults: AnthropicContentBlock[] = [];
      while (i < messages.length && messages[i]!.role === 'tool') {
        const toolMsg = messages[i]!;
        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolMsg.tool_call_id ?? '',
          content: toolMsg.content ?? '',
        });
        i++;
      }
      i--; // outer loop will increment once more
      result.push({ role: 'user', content: toolResults });
    }
  }

  return { system, messages: result };
}

// --- Provider ----------------------------------------------------------------

export interface AnthropicOptions {
  config: CloudConfig;
  onToken?: (tok: string) => void;
  onToolCall?: (name: string, args: string) => void;
  signal?: AbortSignal;
}

export class AnthropicProvider implements LlmProvider {
  readonly id = 'anthropic';
  readonly label = 'Anthropic Claude';
  readonly requiresModelDownload = false;

  constructor(private opts: AnthropicOptions) {}

  async isAvailable(): Promise<boolean> {
    const { apiKey, model } = this.opts.config;
    return Boolean(apiKey.trim() && model.trim());
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

  async getLlmRecipeDetails(name: string): Promise<LlmRecipeDetails | null> {
    const system = [
      'You are a cocktail expert. Return a JSON recipe for the requested drink.',
      'Keys: ingredients (array of {name: string, amount: string}), instructions (2-3 sentences), garnish (short phrase or null), glass (glass type).',
      'Use standard bartender amounts (oz or dashes). Return ONLY the JSON object, no preamble.',
    ].join(' ');
    try {
      const raw = await this.completeJson([
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

  async inventFromPantry(
    query: string,
    pantryIds: string[],
    data: DataIndex,
  ): Promise<InventedRecipe[]> {
    if (pantryIds.length === 0) return [];
    const pantryLines = pantryIds
      .map((id) => data.ingredientById.get(id)?.name ?? id)
      .join(', ');
    const system = [
      'You are a cocktail inventor. Design 2-3 original cocktails from the user\'s pantry.',
      'Follow family balance: sour=2oz spirit:1oz citrus:0.75oz sweetener, old_fashioned=2oz spirit+bitters+sugar, highball=1.5oz spirit+4oz mixer, martini=2oz spirit+0.75oz modifier.',
      'Use primarily pantry ingredients (ingredientId must be from the pantry list).',
      'You MAY add up to 2 extra items per drink in "alsoNeeded" as free-text strings (e.g. "2 dashes cardamom bitters").',
      'Names: max 4 words, distinctive, no generic names.',
      'Return ONLY JSON: { "inventions": [ { name, family, method, glass, garnish, instructions, reasoning, ingredients: [{ingredientId, amountDisplay, amountMl, position}], alsoNeeded: [] } ] }',
      'Valid family: sour|highball|old_fashioned|spritz|martini|flip|fizz|julep|other',
      'Valid method: shake|stir|build|blend|throw',
      'Valid glass: coupe|rocks|highball|collins|martini|nick_and_nora|wine|flute|julep|hurricane',
      `Pantry ingredient IDs: ${pantryIds.join(', ')}`,
    ].join(' ');
    const user = `Pantry: ${pantryLines}\n\nRequest: ${query.trim() || 'Invent something interesting.'}`;
    try {
      const raw = await this.completeJson([
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

  // --- Core tool loop ---------------------------------------------------------
  // Mirrors OpenAiCompatProvider.runToolLoop; differences are only in how
  // streamCompletion talks to the wire.

  private async runToolLoop(
    messages: ChatMessage[],
    data: DataIndex,
    pantryIds: string[],
    terminator: 'finalize_pantry' | 'finalize_intent',
  ): Promise<{ name: string; args: unknown }> {
    const maxIterations = 6;
    for (let i = 0; i < maxIterations; i++) {
      const { content, toolCalls } = await this.streamCompletion(messages);

      messages.push({
        role: 'assistant',
        content: content || null,
        tool_calls: toolCalls.length ? toolCalls : undefined,
      });

      if (toolCalls.length === 0) {
        messages.push({
          role: 'user',
          content: `Please call ${terminator} with your answer now.`,
        });
        continue;
      }

      for (const call of toolCalls) {
        this.opts.onToolCall?.(call.function.name, call.function.arguments);
        if (call.function.name === terminator) {
          return { name: call.function.name, args: safeParseObject(call.function.arguments) };
        }
        const result = executeTool(call.function.name, call.function.arguments, data, pantryIds);
        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify(result),
        });
      }
    }
    throw new Error(`Anthropic LLM did not call ${terminator} within ${maxIterations} iterations.`);
  }

  // --- Streaming completions (Anthropic SSE) ----------------------------------

  private async streamCompletion(
    messages: ChatMessage[],
  ): Promise<{ content: string; toolCalls: ChatToolCall[] }> {
    const { config, signal } = this.opts;
    const url = `${config.baseUrl.replace(/\/+$/, '')}/messages`;

    const { system, messages: anthropicMessages } = toAnthropicPayload(messages);

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
      },
      signal,
      body: JSON.stringify({
        model: config.model,
        max_tokens: 4096,
        stream: true,
        ...(system ? { system } : {}),
        messages: anthropicMessages,
        tools: ANTHROPIC_TOOLS,
        tool_choice: { type: 'auto' },
      }),
    });

    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => '');
      throw new Error(
        `Anthropic request failed: ${res.status} ${res.statusText} ${text.slice(0, 300)}`,
      );
    }

    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = '';

    // Track content blocks by stream index.
    interface TrackedBlock {
      type: 'text' | 'tool_use';
      text: string;
      id: string;
      name: string;
      inputJson: string;
    }
    const blocks = new Map<number, TrackedBlock>();

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += value;

      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const raw of lines) {
        const line = raw.trim();
        // Anthropic SSE emits `event:` lines too; we care only about `data:`.
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();

        let event: AnthropicSSEEvent;
        try {
          event = JSON.parse(payload) as AnthropicSSEEvent;
        } catch {
          continue;
        }

        if (event.type === 'content_block_start' && event.content_block) {
          const cb = event.content_block;
          blocks.set(event.index ?? 0, {
            type: cb.type,
            text: cb.text ?? '',
            id: cb.id ?? '',
            name: cb.name ?? '',
            inputJson: '',
          });
        } else if (event.type === 'content_block_delta' && event.delta) {
          const block = blocks.get(event.index ?? 0);
          if (!block) continue;
          if (event.delta.type === 'text_delta' && event.delta.text) {
            block.text += event.delta.text;
            this.opts.onToken?.(event.delta.text);
          } else if (event.delta.type === 'input_json_delta' && event.delta.partial_json) {
            block.inputJson += event.delta.partial_json;
          }
        }
      }
    }

    // Assemble OpenAI-shaped output from tracked Anthropic content blocks.
    let content = '';
    const toolCalls: ChatToolCall[] = [];

    for (const [, block] of blocks) {
      if (block.type === 'text') {
        content += block.text;
      } else if (block.type === 'tool_use' && block.name) {
        const argsJson = block.inputJson || '{}';
        this.opts.onToolCall?.(block.name, argsJson);
        toolCalls.push({
          id: block.id || `call_${toolCalls.length}`,
          type: 'function',
          function: { name: block.name, arguments: argsJson },
        });
      }
    }

    return { content, toolCalls };
  }

  // --- Non-streaming JSON completion ------------------------------------------
  // Used for proposeRecipe, getLlmRecipeDetails, inventFromPantry where the
  // output is a single structured JSON object and streaming is unnecessary.

  private async completeJson(messages: ChatMessage[]): Promise<Record<string, unknown>> {
    const { config, signal } = this.opts;
    const url = `${config.baseUrl.replace(/\/+$/, '')}/messages`;

    const { system, messages: anthropicMessages } = toAnthropicPayload(messages);

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
      },
      signal,
      body: JSON.stringify({
        model: config.model,
        max_tokens: 1024,
        temperature: 0.7,
        ...(system ? { system } : {}),
        messages: anthropicMessages,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(
        `Anthropic request failed: ${res.status} ${res.statusText} ${text.slice(0, 200)}`,
      );
    }

    const body = (await res.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };

    const text = body.content?.find((b) => b.type === 'text')?.text ?? '{}';
    try {
      return JSON.parse(text) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
}
