import { describe, expect, it } from 'vitest';
import { DATA } from '../data';
import { check_pantry, get_recipe, get_substitutes, search_recipes } from './tools';

describe('search_recipes', () => {
  it('filters by required ingredient (hierarchy-aware)', () => {
    // "gin" is a parent; Negroni uses london dry gin (descendant). Should match.
    const hits = search_recipes({ has_ingredients: ['gin'] }, DATA);
    const names = hits.map((h) => h.name);
    expect(names).toContain('Negroni');
  });

  it('filters by family', () => {
    const hits = search_recipes({ family: 'spritz', max_results: 20 }, DATA);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((h) => h.family === 'spritz')).toBe(true);
  });

  it('requires tag overlap when flavor_tags given', () => {
    const hits = search_recipes({ flavor_tags: ['smoky'], max_results: 20 }, DATA);
    // We seeded no "smoky" recipes — should return zero.
    expect(hits.length).toBe(0);
  });

  it('ranks IBA officials and tag overlap higher', () => {
    const hits = search_recipes({ flavor_tags: ['bitter', 'spirit_forward'], max_results: 5 }, DATA);
    expect(hits.length).toBeGreaterThan(0);
    // Negroni has both bitter + spirit_forward + IBA — should be at/near the top.
    expect(hits[0]!.name).toBe('Negroni');
  });

  it('respects max_results', () => {
    const hits = search_recipes({ max_results: 3 }, DATA);
    expect(hits.length).toBeLessThanOrEqual(3);
  });
});

describe('get_recipe', () => {
  it('returns ingredient names joined', () => {
    const r = get_recipe('negroni', DATA);
    expect(r).not.toBeNull();
    expect(r!.name).toBe('Negroni');
    expect(r!.ingredients.length).toBe(3);
    expect(r!.ingredients.every((i) => i.ingredient_name)).toBe(true);
  });

  it('returns null for unknown id', () => {
    expect(get_recipe('nope', DATA)).toBeNull();
  });
});

describe('get_substitutes', () => {
  it('returns substitutes sorted by strength desc', () => {
    const res = get_substitutes('lime_juice', DATA);
    if (res.substitutes.length > 1) {
      for (let i = 1; i < res.substitutes.length; i++) {
        expect(res.substitutes[i]!.strength).toBeLessThanOrEqual(res.substitutes[i - 1]!.strength);
      }
    }
  });
});

describe('check_pantry', () => {
  it('covers descendant via parent in pantry', () => {
    // Pantry has "gin" (parent); asking about london dry gin (descendant) should count as covered.
    const { have, missing } = check_pantry(['gin_london_dry'], ['gin'], DATA);
    expect(have).toContain('gin_london_dry');
    expect(missing).toHaveLength(0);
  });

  it('covers parent via descendant in pantry', () => {
    const { have } = check_pantry(['gin'], ['gin_london_dry'], DATA);
    expect(have).toContain('gin');
  });

  it('reports missing when neither ancestor nor descendant present', () => {
    const { missing } = check_pantry(['campari'], ['gin_london_dry'], DATA);
    expect(missing).toContain('campari');
  });
});
