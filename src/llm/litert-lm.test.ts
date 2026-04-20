import { describe, expect, it } from 'vitest';
import { safeJsonParse } from './litert-lm';

describe('safeJsonParse', () => {
  it('parses clean JSON', () => {
    expect(safeJsonParse('{"a":1}')).toEqual({ a: 1 });
  });

  it('handles JSON wrapped in Markdown fences', () => {
    const text = 'Sure, here is your result:\n```json\n{"a":1,"b":"x"}\n```\n';
    expect(safeJsonParse(text)).toEqual({ a: 1, b: 'x' });
  });

  it('recovers a JSON object embedded in prose', () => {
    const text = 'I think the answer is {"interpretation":"tart","matches":[]} — cheers!';
    expect(safeJsonParse(text)).toEqual({ interpretation: 'tart', matches: [] });
  });

  it('tolerates trailing commas in extracted blocks', () => {
    const text = '{"resolved":[{"input":"gin","ingredient_id":"gin","confidence":0.9},],"unresolved":[]}';
    const parsed = safeJsonParse(text);
    expect(parsed?.resolved?.[0]?.ingredient_id).toBe('gin');
  });

  it('returns null for genuinely broken output rather than throwing', () => {
    expect(safeJsonParse('not json at all')).toBeNull();
  });

  it('does not include text after the first balanced object', () => {
    const text = '{"a":1} then some unrelated prose {"b":2}';
    expect(safeJsonParse(text)).toEqual({ a: 1 });
  });
});
