import { describe, expect, it } from 'vitest';
import { DATA } from '../data';
import { HeuristicProvider } from './heuristic';

const provider = new HeuristicProvider();

describe('HeuristicProvider.parseIngredients', () => {
  it('resolves exact alias', async () => {
    const res = await provider.parseIngredients('lime juice', DATA);
    expect(res.resolved.map((r) => r.ingredientId)).toContain('lime_juice');
  });

  it('resolves bare name via substring', async () => {
    // "lime" should map to lime_juice (juice ingredient) — substring containment.
    const res = await provider.parseIngredients('lime', DATA);
    expect(res.resolved.length).toBeGreaterThan(0);
  });

  it('resolves bare "gin" via its intentional alias to London Dry', async () => {
    // Alias map maps "gin" → london dry (the common default).
    const res = await provider.parseIngredients('gin', DATA);
    const ids = res.resolved.map((r) => r.ingredientId);
    expect(ids).toContain('gin_london_dry');
  });

  it('splits on commas and "and"', async () => {
    const res = await provider.parseIngredients('gin, campari and sweet vermouth', DATA);
    const ids = res.resolved.map((r) => r.ingredientId);
    expect(ids).toContain('gin_london_dry');
    expect(ids).toContain('campari');
    expect(ids).toContain('vermouth_sweet');
  });

  it('tolerates typos via Levenshtein', async () => {
    const res = await provider.parseIngredients('campri', DATA);
    expect(res.resolved.map((r) => r.ingredientId)).toContain('campari');
  });

  it('strips leading hedges like "some" and "a splash of"', async () => {
    const res = await provider.parseIngredients('some gin, a splash of lime juice', DATA);
    const ids = res.resolved.map((r) => r.ingredientId);
    expect(ids).toContain('gin_london_dry');
    expect(ids).toContain('lime_juice');
  });

  it('returns unresolved phrases when nothing matches', async () => {
    const res = await provider.parseIngredients('unicorn tears', DATA);
    expect(res.unresolved.length).toBeGreaterThan(0);
  });

  it('does not duplicate the same ingredient', async () => {
    const res = await provider.parseIngredients('gin, gin, gin', DATA);
    expect(res.resolved.length).toBe(1);
  });
});

describe('HeuristicProvider.searchIntent', () => {
  it('interprets "bitter stirred" as negroni-family territory', async () => {
    const res = await provider.searchIntent('something bitter and stirred', [], DATA);
    const names = res.matches.map((m) => m.recipeName);
    expect(names).toContain('Negroni');
  });

  it('prioritises makeable cocktails when pantry fits', async () => {
    const res = await provider.searchIntent(
      'something bitter',
      ['gin_london_dry', 'campari', 'vermouth_sweet'],
      DATA,
    );
    // Negroni should appear as "now" makeable
    const negroni = res.matches.find((m) => m.recipeId === 'negroni');
    expect(negroni).toBeDefined();
    expect(negroni!.makeability).toBe('now');
    // And come before any cannot_make match
    const firstCannot = res.matches.findIndex((m) => m.makeability === 'cannot_make');
    const negroniIdx = res.matches.findIndex((m) => m.recipeId === 'negroni');
    if (firstCannot >= 0) {
      expect(negroniIdx).toBeLessThan(firstCannot);
    }
  });

  it('extracts ingredient hints from the query', async () => {
    const res = await provider.searchIntent('something with mezcal', [], DATA);
    expect(res.interpretation).toMatch(/mezcal/i);
  });

  it('falls back to ignoring tags when no recipe matches the tag filter', async () => {
    // No recipes are tagged smoky; provider should fall back + add a note.
    const res = await provider.searchIntent('smoky', [], DATA);
    expect(res.matches.length).toBeGreaterThan(0);
    expect(res.notes).toBeTruthy();
  });

  it('builds a human-readable interpretation', async () => {
    const res = await provider.searchIntent('refreshing citrus', [], DATA);
    expect(res.interpretation).toMatch(/refreshing|citrus/i);
  });

  it('uses vodka as a hard ingredient filter when the query names it', async () => {
    // The bug: before the fix, "basil forward vodka cocktail" returned gin/rum.
    const res = await provider.searchIntent('basil forward vodka cocktail', [], DATA);
    expect(res.matches.length).toBeGreaterThan(0);
    // Every result must contain vodka (or a descendant) as an ingredient.
    const allVodka = res.matches.every((m) => {
      const recipe = DATA.recipeById.get(m.recipeId);
      if (!recipe) return true; // llm-generated; skip
      return recipe.ingredients.some((ri) => {
        const ancs = DATA.ancestors.get(ri.ingredientId) ?? new Set([ri.ingredientId]);
        return ancs.has('vodka') || ri.ingredientId === 'vodka';
      });
    });
    expect(allVodka).toBe(true);
  });

  it('ranks recipes containing the queried spirit above others', async () => {
    // With an explicit spirit in the query, results that contain it should rank first.
    const res = await provider.searchIntent('vodka drink', [], DATA);
    const firstNonVodka = res.matches.findIndex((m) => {
      const recipe = DATA.recipeById.get(m.recipeId);
      if (!recipe) return false;
      return !recipe.ingredients.some((ri) => {
        const ancs = DATA.ancestors.get(ri.ingredientId) ?? new Set([ri.ingredientId]);
        return ancs.has('vodka') || ri.ingredientId === 'vodka';
      });
    });
    // Either all results are vodka, or vodka results come before non-vodka ones.
    if (firstNonVodka >= 0) {
      const firstVodka = res.matches.findIndex((m) => {
        const recipe = DATA.recipeById.get(m.recipeId);
        if (!recipe) return false;
        return recipe.ingredients.some((ri) => {
          const ancs = DATA.ancestors.get(ri.ingredientId) ?? new Set([ri.ingredientId]);
          return ancs.has('vodka') || ri.ingredientId === 'vodka';
        });
      });
      if (firstVodka >= 0) expect(firstVodka).toBeLessThan(firstNonVodka);
    }
  });
});

describe('HeuristicProvider.inventFromPantry', () => {
  it('returns generated candidates from the pantry', async () => {
    const pantry = ['gin_london_dry', 'lime_juice', 'simple_syrup', 'angostura_bitters'];
    const results = await provider.inventFromPantry('invent something', pantry, DATA);
    expect(results.length).toBeGreaterThan(0);
    // All ingredient IDs in generated recipes must be from the pantry.
    for (const inv of results) {
      for (const ri of inv.ingredients) {
        expect(pantry).toContain(ri.ingredientId);
      }
    }
  });

  it('when a specific spirit is requested, returns only that spirit', async () => {
    // Pantry has both gin and vodka; query asks specifically for vodka.
    const pantry = ['gin_london_dry', 'vodka', 'lime_juice', 'simple_syrup', 'tonic_water'];
    const results = await provider.inventFromPantry('a vodka cocktail please', pantry, DATA);
    expect(results.length).toBeGreaterThan(0);
    for (const inv of results) {
      const hasVodka = inv.ingredients.some((ri) => {
        const ancs = DATA.ancestors.get(ri.ingredientId) ?? new Set([ri.ingredientId]);
        return ancs.has('vodka') || ri.ingredientId === 'vodka';
      });
      expect(hasVodka).toBe(true);
    }
  });

  it('returns results even when the pantry is sparse', async () => {
    // Single spirit + single mixer — at least one highball-style candidate.
    const pantry = ['vodka', 'tonic_water'];
    const results = await provider.inventFromPantry('', pantry, DATA);
    expect(results.length).toBeGreaterThanOrEqual(1);
  });
});
