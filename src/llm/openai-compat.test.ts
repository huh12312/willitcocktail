import { describe, it, expect } from 'vitest';
import { DATA } from '../data';
import { mapFinalizePantry, parseInventedRecipe } from './openai-compat';

// ---------------------------------------------------------------------------
// mapFinalizePantry
// ---------------------------------------------------------------------------

describe('mapFinalizePantry', () => {
  function make(resolved: unknown[], unresolved: string[] = []) {
    return { name: 'finalize_pantry', args: { resolved, unresolved } };
  }

  it('resolves a known ingredient ID', () => {
    const result = mapFinalizePantry(
      make([{ input: 'gin', ingredient_id: 'gin_london_dry', confidence: 0.9 }]),
      DATA,
    );
    expect(result.resolved.map((r) => r.ingredientId)).toContain('gin_london_dry');
    expect(result.resolved[0].confidence).toBe(0.9);
    expect(result.resolved[0].ingredientName).toBeTruthy();
  });

  it('silently drops unknown ingredient IDs', () => {
    const result = mapFinalizePantry(
      make([{ input: 'mythical', ingredient_id: 'unicorn_tears_9000', confidence: 0.5 }]),
      DATA,
    );
    expect(result.resolved).toHaveLength(0);
  });

  it('deduplicates the same ingredient ID', () => {
    const result = mapFinalizePantry(
      make([
        { input: 'gin', ingredient_id: 'gin_london_dry', confidence: 0.9 },
        { input: 'london dry', ingredient_id: 'gin_london_dry', confidence: 1.0 },
      ]),
      DATA,
    );
    expect(
      result.resolved.filter((r) => r.ingredientId === 'gin_london_dry').length,
    ).toBe(1);
  });

  it('passes through unresolved phrases unchanged', () => {
    const result = mapFinalizePantry(make([], ['unicorn tears', 'dragon blood']), DATA);
    expect(result.unresolved).toEqual(['unicorn tears', 'dragon blood']);
  });

  it('handles missing args gracefully', () => {
    const result = mapFinalizePantry({ name: 'finalize_pantry', args: {} }, DATA);
    expect(result.resolved).toHaveLength(0);
    expect(result.unresolved).toHaveLength(0);
  });

  it('uses ingredient name as input fallback when input field is absent', () => {
    const result = mapFinalizePantry(
      make([{ ingredient_id: 'lime_juice', confidence: 1.0 }]),
      DATA,
    );
    expect(result.resolved[0].input).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// parseInventedRecipe
// ---------------------------------------------------------------------------

describe('parseInventedRecipe', () => {
  const pantryIds = ['gin_london_dry', 'lime_juice', 'simple_syrup'];

  function makeRaw(overrides: Record<string, unknown> = {}) {
    return {
      name: 'Test Smash',
      family: 'sour',
      method: 'shake',
      glass: 'coupe',
      instructions: 'Shake and strain.',
      garnish: 'Lime wheel',
      ingredients: [
        { ingredientId: 'gin_london_dry', amountDisplay: '2 oz', amountMl: 60, position: 1 },
        { ingredientId: 'lime_juice',     amountDisplay: '0.75 oz', amountMl: 22, position: 2 },
        { ingredientId: 'simple_syrup',   amountDisplay: '0.5 oz', amountMl: 15, position: 3 },
      ],
      alsoNeeded: [],
      ...overrides,
    };
  }

  it('parses a valid well-formed recipe', () => {
    const result = parseInventedRecipe(makeRaw(), pantryIds, DATA);
    expect(result).not.toBeNull();
    expect(result!.name).toBe('Test Smash');
    expect(result!.family).toBe('sour');
    expect(result!.method).toBe('shake');
    expect(result!.glass).toBe('coupe');
    expect(result!.missing).toHaveLength(0);
  });

  it('returns null when name is empty', () => {
    expect(parseInventedRecipe(makeRaw({ name: '' }), pantryIds, DATA)).toBeNull();
  });

  it('returns null when fewer than 2 valid ingredients', () => {
    const raw = makeRaw({
      ingredients: [
        { ingredientId: 'gin_london_dry', amountDisplay: '2 oz', amountMl: 60, position: 1 },
      ],
    });
    expect(parseInventedRecipe(raw, pantryIds, DATA)).toBeNull();
  });

  it('falls back to "other" for an invalid family', () => {
    const result = parseInventedRecipe(makeRaw({ family: 'negroni_style' }), pantryIds, DATA);
    expect(result!.family).toBe('other');
  });

  it('falls back to "shake" for an invalid method', () => {
    const result = parseInventedRecipe(makeRaw({ method: 'teleport' }), pantryIds, DATA);
    expect(result!.method).toBe('shake');
  });

  it('falls back to "coupe" for an invalid glass', () => {
    const result = parseInventedRecipe(makeRaw({ glass: 'pint_glass' }), pantryIds, DATA);
    expect(result!.glass).toBe('coupe');
  });

  it('marks ingredients not in pantry as missing', () => {
    const raw = makeRaw({
      ingredients: [
        { ingredientId: 'bourbon',    amountDisplay: '2 oz', amountMl: 60, position: 1 },
        { ingredientId: 'lime_juice', amountDisplay: '0.75 oz', amountMl: 22, position: 2 },
      ],
    });
    const result = parseInventedRecipe(raw, pantryIds, DATA);
    expect(result!.missing).toContain('bourbon');
    expect(result!.missing).not.toContain('lime_juice');
  });

  it('drops ingredient IDs that are not in the canonical database', () => {
    const raw = makeRaw({
      ingredients: [
        { ingredientId: 'gin_london_dry', amountDisplay: '2 oz', amountMl: 60, position: 1 },
        { ingredientId: 'HALLUCINATED_XYZ', amountDisplay: '1 oz', amountMl: 30, position: 2 },
        { ingredientId: 'lime_juice', amountDisplay: '0.75 oz', amountMl: 22, position: 3 },
      ],
    });
    const result = parseInventedRecipe(raw, pantryIds, DATA);
    expect(result).not.toBeNull();
    const ids = result!.ingredients.map((i) => i.ingredientId);
    expect(ids).not.toContain('HALLUCINATED_XYZ');
    expect(ids).toContain('gin_london_dry');
    expect(ids).toContain('lime_juice');
  });

  it('collects alsoNeeded strings', () => {
    const raw = makeRaw({ alsoNeeded: ['2 dashes cardamom bitters', 'fresh basil leaf'] });
    const result = parseInventedRecipe(raw, pantryIds, DATA);
    expect(result!.alsoNeeded).toHaveLength(2);
    expect(result!.alsoNeeded[0]).toBe('2 dashes cardamom bitters');
  });
});
