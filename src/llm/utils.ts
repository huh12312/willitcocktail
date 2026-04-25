import type { DataIndex } from '../data';

/**
 * Shared LLM provider utilities used across all provider implementations.
 */

/** Sanitise an LLM-produced string: trim, enforce max length, fallback if empty. */
export function sanitiseString(v: unknown, fallback: string, maxLen: number): string {
  const s = typeof v === 'string' ? v.trim() : '';
  if (!s) return fallback;
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

/**
 * Robust JSON parse tolerating markdown code fences, preamble text, and
 * trailing commas — common failure modes of smaller LLMs.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function safeJsonParse(text: string): any {
  const direct = tryParse(text);
  if (direct !== undefined) return direct;

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    const f = tryParse(fenced[1]);
    if (f !== undefined) return f;
  }

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function tryParse(s: string): any | undefined {
  try {
    return JSON.parse(s);
  } catch {
    return undefined;
  }
}

/**
 * Format a millilitre amount as an oz display string. Range guards handle
 * common cocktail pours (including generator output snapped to 5 ml);
 * unusual values snap to the nearest 0.25 oz.
 */
export function formatMlToOz(ml: number): string {
  if (ml >= 14 && ml <= 16) return '0.5 oz';
  if (ml >= 21 && ml <= 23) return '0.75 oz';
  if (ml >= 29 && ml <= 31) return '1 oz';
  if (ml >= 43 && ml <= 47) return '1.5 oz';
  if (ml >= 58 && ml <= 62) return '2 oz';
  const snapped = Math.round((ml / 30) * 4) / 4;
  return `${snapped} oz`;
}

/**
 * Scan a natural-language query for all ingredient mentions using word-boundary
 * matching. Returns every ingredient whose name or alias appears as a whole word
 * in the query — "ginger" does not match "gin", "lime" does not match "limeade".
 * When both a parent and child ingredient match, the child is kept (more specific).
 */
export function extractQueryIngredients(query: string, data: DataIndex): string[] {
  const found = new Set<string>();

  for (const ing of data.ingredients) {
    const name = ing.name.toLowerCase();
    if (name.length < 3) continue;
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp(`\\b${escaped}\\b`, 'i').test(query)) found.add(ing.id);
  }

  for (const [alias, id] of data.aliasMap) {
    if (alias.length < 3) continue;
    const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp(`\\b${escaped}\\b`, 'i').test(query)) found.add(id);
  }

  // Keep only the most specific match when parent and child both fire.
  return [...found].filter((id) => {
    const ing = data.ingredientById.get(id);
    return !ing?.parentId || !found.has(ing.parentId);
  });
}
