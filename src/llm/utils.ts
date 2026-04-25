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
export function safeJsonParse(text: string): unknown {
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

function tryParse(s: string): unknown | undefined {
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
