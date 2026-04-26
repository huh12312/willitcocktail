import { describe, it, expect } from 'vitest';
import { DATA } from '../data';
import { getGrammar } from '../data/grammars';
import { scoreCandidate } from './validator';
import type { Recipe } from '../types';

const sourGrammar = getGrammar('sour')!;

function makeSour(overrides: Partial<Recipe> = {}): Recipe {
  return {
    id: 'test_sour',
    name: 'Test Sour',
    family: 'sour',
    method: 'shake',
    glass: 'coupe',
    instructions: 'Shake and strain.',
    source: 'generated',
    ibaOfficial: false,
    // Exactly 2:1:1 matches the sour grammar's ratio target → zero deviation.
    ingredients: [
      { ingredientId: 'gin_london_dry', amountMl: 60, amountDisplay: '2 oz',   position: 1 },
      { ingredientId: 'lime_juice',     amountMl: 30, amountDisplay: '1 oz',   position: 2 },
      { ingredientId: 'simple_syrup',   amountMl: 30, amountDisplay: '1 oz',   position: 3 },
    ],
    ...overrides,
  };
}

describe('scoreCandidate', () => {
  it('gives a high score to a balanced sour', () => {
    const score = scoreCandidate(makeSour(), sourGrammar, {}, DATA);
    expect(score.total).toBeGreaterThan(0.5);
    expect(score.balanceNotes).toContain('balanced');
  });

  it('total is in [0, 1]', () => {
    const score = scoreCandidate(makeSour(), sourGrammar, {}, DATA);
    expect(score.total).toBeGreaterThanOrEqual(0);
    expect(score.total).toBeLessThanOrEqual(1);
  });

  it('penalises total volume below the minimum', () => {
    const recipe = makeSour({
      ingredients: [
        { ingredientId: 'gin_london_dry', amountMl: 5, amountDisplay: '0.17 oz', position: 1 },
        { ingredientId: 'lime_juice',     amountMl: 2, amountDisplay: '0.07 oz', position: 2 },
        { ingredientId: 'simple_syrup',   amountMl: 1, amountDisplay: '0.03 oz', position: 3 },
      ],
    });
    const score = scoreCandidate(recipe, sourGrammar, {}, DATA);
    expect(score.volume).toBeLessThan(1);
    expect(score.balanceNotes.some((n) => n.includes('under'))).toBe(true);
  });

  it('penalises two citrus sources (palate crowding)', () => {
    const recipe = makeSour({
      ingredients: [
        { ingredientId: 'gin_london_dry', amountMl: 60, amountDisplay: '2 oz', position: 1 },
        { ingredientId: 'lime_juice',     amountMl: 22, amountDisplay: '0.75 oz', position: 2 },
        { ingredientId: 'lemon_juice',    amountMl: 22, amountDisplay: '0.75 oz', position: 3 },
        { ingredientId: 'simple_syrup',   amountMl: 15, amountDisplay: '0.5 oz', position: 4 },
      ],
    });
    const score = scoreCandidate(recipe, sourGrammar, {}, DATA);
    expect(score.balanceNotes.some((n) => n.includes('two citrus'))).toBe(true);

    const balanced = scoreCandidate(makeSour(), sourGrammar, {}, DATA);
    expect(score.total).toBeLessThan(balanced.total);
  });

  it('off-ratio recipe scores worse than balanced', () => {
    // Way too much citrus relative to spirit
    const unbalanced = makeSour({
      ingredients: [
        { ingredientId: 'gin_london_dry', amountMl: 15, amountDisplay: '0.5 oz', position: 1 },
        { ingredientId: 'lime_juice',     amountMl: 90, amountDisplay: '3 oz', position: 2 },
        { ingredientId: 'simple_syrup',   amountMl: 15, amountDisplay: '0.5 oz', position: 3 },
      ],
    });
    const balanced = scoreCandidate(makeSour(), sourGrammar, {}, DATA);
    const bad = scoreCandidate(unbalanced, sourGrammar, {}, DATA);
    expect(bad.ratio).toBeLessThan(balanced.ratio);
  });
});
