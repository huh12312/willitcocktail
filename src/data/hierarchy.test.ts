import { describe, it, expect } from 'vitest';
import { buildDataIndex } from './index';
import type { Ingredient, Recipe } from '../types';

const ingredients: Ingredient[] = [
  { id: 'spirit',         name: 'Spirit',         category: 'spirit' },
  { id: 'gin',            name: 'Gin',             category: 'spirit', parentId: 'spirit' },
  { id: 'gin_london_dry', name: 'London Dry Gin',  category: 'spirit', parentId: 'gin' },
  { id: 'vodka',          name: 'Vodka',           category: 'spirit', parentId: 'spirit' },
  { id: 'campari',        name: 'Campari',         category: 'bitter' },
];

const recipes: Recipe[] = [
  {
    id: 'gimlet', name: 'Gimlet', family: 'sour', method: 'shake',
    glass: 'coupe', instructions: '', source: 'iba', ibaOfficial: true,
    ingredients: [{ ingredientId: 'gin', amountMl: 60, amountDisplay: '2 oz', position: 1 }],
  },
];

describe('buildDataIndex', () => {
  it('builds ingredientById map', () => {
    const data = buildDataIndex(ingredients, [], [], []);
    expect(data.ingredientById.get('gin')?.name).toBe('Gin');
    expect(data.ingredientById.get('campari')?.category).toBe('bitter');
    expect(data.ingredientById.size).toBe(ingredients.length);
  });

  it('builds recipeById map', () => {
    const data = buildDataIndex(ingredients, [], [], recipes);
    expect(data.recipeById.get('gimlet')?.name).toBe('Gimlet');
    expect(data.recipeById.get('nope')).toBeUndefined();
  });

  it('builds lowercase aliasMap', () => {
    const data = buildDataIndex(
      ingredients,
      [{ alias: 'LDG', ingredientId: 'gin_london_dry' }],
      [], [],
    );
    // Aliases are stored lowercased.
    expect(data.aliasMap.get('ldg')).toBe('gin_london_dry');
    expect(data.aliasMap.has('LDG')).toBe(false);
  });

  it('descendants of a parent include self, children, and grandchildren', () => {
    const data = buildDataIndex(ingredients, [], [], []);
    const desc = data.descendants.get('spirit')!;
    expect(desc.has('spirit')).toBe(true);
    expect(desc.has('gin')).toBe(true);
    expect(desc.has('gin_london_dry')).toBe(true);
    expect(desc.has('vodka')).toBe(true);
    expect(desc.has('campari')).toBe(false); // different branch
  });

  it('descendants of a leaf node contain only itself', () => {
    const data = buildDataIndex(ingredients, [], [], []);
    const desc = data.descendants.get('gin_london_dry')!;
    expect(desc.size).toBe(1);
    expect(desc.has('gin_london_dry')).toBe(true);
  });

  it('ancestors of a grandchild include full parent chain', () => {
    const data = buildDataIndex(ingredients, [], [], []);
    const ancs = data.ancestors.get('gin_london_dry')!;
    expect(ancs.has('gin_london_dry')).toBe(true);
    expect(ancs.has('gin')).toBe(true);
    expect(ancs.has('spirit')).toBe(true);
    expect(ancs.has('vodka')).toBe(false);
  });

  it('ancestors of a root node contain only itself', () => {
    const data = buildDataIndex(ingredients, [], [], []);
    const ancs = data.ancestors.get('spirit')!;
    expect(ancs.size).toBe(1);
    expect(ancs.has('spirit')).toBe(true);
  });

  it('builds substitutesOf index', () => {
    const data = buildDataIndex(
      ingredients, [], [{ ingredientId: 'gin', substituteId: 'vodka', strength: 0.7 }], [],
    );
    const subs = data.substitutesOf.get('gin')!;
    expect(subs.length).toBe(1);
    expect(subs[0].substituteId).toBe('vodka');
  });
});
