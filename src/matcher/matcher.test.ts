import { describe, expect, it } from 'vitest';
import { matchRecipes, groupByTier } from './index';
import type { Ingredient, IngredientAlias, Recipe, Substitute } from '../types';
import { buildDataIndex } from '../data';

// Small synthetic fixture so tests don't couple to seed data quirks.
const ingredients: Ingredient[] = [
  { id: 'gin', name: 'Gin', category: 'spirit' },
  { id: 'gin_ldn', name: 'London Dry', category: 'spirit', parentId: 'gin' },
  { id: 'gin_plymouth', name: 'Plymouth', category: 'spirit', parentId: 'gin' },
  { id: 'vermouth_dry', name: 'Dry Vermouth', category: 'wine' },
  { id: 'lime_juice', name: 'Lime Juice', category: 'juice' },
  { id: 'lemon_juice', name: 'Lemon Juice', category: 'juice' },
  { id: 'simple_syrup', name: 'Simple Syrup', category: 'syrup' },
  { id: 'tonic_water', name: 'Tonic', category: 'mixer' },
  { id: 'cointreau', name: 'Cointreau', category: 'liqueur' },
  { id: 'triple_sec', name: 'Triple Sec', category: 'liqueur' },
];

const aliases: IngredientAlias[] = [];

const substitutes: Substitute[] = [
  { ingredientId: 'lime_juice', substituteId: 'lemon_juice', strength: 0.7 },
  { ingredientId: 'lemon_juice', substituteId: 'lime_juice', strength: 0.7 },
  { ingredientId: 'cointreau', substituteId: 'triple_sec', strength: 0.85 },
];

const recipes: Recipe[] = [
  {
    id: 'gimlet',
    name: 'Gimlet',
    family: 'sour',
    method: 'shake',
    glass: 'coupe',
    instructions: '',
    source: 'iba',
    ibaOfficial: true,
    ingredients: [
      { ingredientId: 'gin', amountMl: 60, amountDisplay: '2 oz', position: 1 },
      { ingredientId: 'lime_juice', amountMl: 22, amountDisplay: '0.75 oz', position: 2 },
      { ingredientId: 'simple_syrup', amountMl: 15, amountDisplay: '0.5 oz', position: 3 },
    ],
  },
  {
    id: 'martini',
    name: 'Martini',
    family: 'martini',
    method: 'stir',
    glass: 'martini',
    instructions: '',
    source: 'iba',
    ibaOfficial: true,
    ingredients: [
      { ingredientId: 'gin_ldn', amountMl: 60, amountDisplay: '2 oz', position: 1 },
      { ingredientId: 'vermouth_dry', amountMl: 10, amountDisplay: '0.25 oz', position: 2 },
    ],
  },
  {
    id: 'gt',
    name: 'G&T',
    family: 'highball',
    method: 'build',
    glass: 'highball',
    instructions: '',
    source: 'iba',
    ibaOfficial: true,
    ingredients: [
      { ingredientId: 'gin', amountMl: 50, amountDisplay: '1.75 oz', position: 1 },
      { ingredientId: 'tonic_water', amountMl: 150, amountDisplay: 'top', position: 2 },
    ],
  },
  {
    id: 'sidecar',
    name: 'Sidecar',
    family: 'sour',
    method: 'shake',
    glass: 'coupe',
    instructions: '',
    source: 'iba',
    ingredients: [
      { ingredientId: 'cointreau', amountMl: 20, amountDisplay: '0.75 oz', position: 1 },
      { ingredientId: 'lemon_juice', amountMl: 20, amountDisplay: '0.75 oz', position: 2 },
    ],
  },
  {
    id: 'fancy',
    name: 'Fancy (2 missing)',
    family: 'sour',
    method: 'shake',
    glass: 'coupe',
    instructions: '',
    source: 'iba',
    ingredients: [
      { ingredientId: 'gin', amountMl: 60, amountDisplay: '2 oz', position: 1 },
      { ingredientId: 'cointreau', amountMl: 15, amountDisplay: '0.5 oz', position: 2 },
      { ingredientId: 'vermouth_dry', amountMl: 10, amountDisplay: '0.25 oz', position: 3 },
    ],
  },
  {
    id: 'optional_egg',
    name: 'With Optional Egg',
    family: 'sour',
    method: 'shake',
    glass: 'coupe',
    instructions: '',
    source: 'iba',
    ingredients: [
      { ingredientId: 'gin', amountMl: 60, amountDisplay: '2 oz', position: 1 },
      { ingredientId: 'lemon_juice', amountMl: 22, amountDisplay: '0.75 oz', position: 2 },
      { ingredientId: 'simple_syrup', amountMl: 15, amountDisplay: '0.5 oz', position: 3 },
      {
        ingredientId: 'tonic_water',
        amountDisplay: 'optional',
        optional: true,
        position: 4,
      },
    ],
  },
];

const data = buildDataIndex(ingredients, aliases, substitutes, recipes);

describe('matcher — exact tier', () => {
  it('matches recipes where every non-optional ingredient is present', () => {
    const pantry = ['gin_ldn', 'lime_juice', 'simple_syrup'];
    const results = matchRecipes(pantry, {}, data);
    const ids = results.filter((r) => r.tier === 'exact').map((r) => r.recipe.id);
    expect(ids).toContain('gimlet');
  });

  it('child ingredient in pantry satisfies recipe calling the parent', () => {
    // gimlet calls for generic "gin"; user has "gin_ldn" (child)
    const pantry = ['gin_ldn', 'lime_juice', 'simple_syrup'];
    const results = matchRecipes(pantry, {}, data);
    const gimlet = results.find((r) => r.recipe.id === 'gimlet');
    expect(gimlet?.tier).toBe('exact');
  });

  it('parent ingredient in pantry satisfies recipe calling a child', () => {
    // martini calls for gin_ldn (child); user only has generic "gin" (parent)
    const pantry = ['gin', 'vermouth_dry'];
    const results = matchRecipes(pantry, {}, data);
    const martini = results.find((r) => r.recipe.id === 'martini');
    expect(martini?.tier).toBe('exact');
  });

  it('optional ingredients do not block exact match', () => {
    const pantry = ['gin', 'lemon_juice', 'simple_syrup']; // no tonic_water
    const results = matchRecipes(pantry, {}, data);
    const r = results.find((x) => x.recipe.id === 'optional_egg');
    expect(r?.tier).toBe('exact');
  });

  it('ranks IBA official exact matches above lower-scored matches', () => {
    const pantry = ['gin', 'lime_juice', 'simple_syrup', 'vermouth_dry', 'tonic_water'];
    const results = matchRecipes(pantry, {}, data);
    expect(results[0]!.tier).toBe('exact');
  });
});

describe('matcher — near tier (substitute)', () => {
  it('swaps lemon for lime via substitute graph', () => {
    // gimlet needs lime; pantry has lemon (sub strength 0.7)
    const pantry = ['gin', 'lemon_juice', 'simple_syrup'];
    const results = matchRecipes(pantry, {}, data);
    const gimlet = results.find((r) => r.recipe.id === 'gimlet');
    expect(gimlet?.tier).toBe('near');
    expect(gimlet?.substitutions).toHaveLength(1);
    expect(gimlet?.substitutions[0]!.originalId).toBe('lime_juice');
    expect(gimlet?.substitutions[0]!.useId).toBe('lemon_juice');
  });

  it('respects minSubstituteStrength threshold', () => {
    // Setting threshold > available substitute strength (0.7) should force near -> almost or drop
    const pantry = ['gin', 'lemon_juice', 'simple_syrup'];
    const results = matchRecipes(pantry, { minSubstituteStrength: 0.9 }, data);
    const gimlet = results.find((r) => r.recipe.id === 'gimlet');
    expect(gimlet?.tier).not.toBe('near');
  });

  it('does not upgrade near to exact when swap is in play', () => {
    const pantry = ['gin_ldn', 'triple_sec', 'lemon_juice']; // sidecar needs cointreau; has triple sec
    const results = matchRecipes(pantry, {}, data);
    const sidecar = results.find((r) => r.recipe.id === 'sidecar');
    expect(sidecar?.tier).toBe('near');
  });
});

describe('matcher — almost tier', () => {
  it('shows recipes with exactly one unresolvable missing ingredient', () => {
    const pantry = ['gin', 'lime_juice']; // gimlet needs simple_syrup, not in pantry, no sub
    const results = matchRecipes(pantry, {}, data);
    const gimlet = results.find((r) => r.recipe.id === 'gimlet');
    expect(gimlet?.tier).toBe('almost');
    expect(gimlet?.missing).toEqual(['simple_syrup']);
  });

  it('does not show recipes missing more than one ingredient', () => {
    const pantry = ['gin']; // fancy needs 3; has 1
    const results = matchRecipes(pantry, {}, data);
    const fancy = results.find((r) => r.recipe.id === 'fancy');
    expect(fancy).toBeUndefined();
  });
});

describe('matcher — strict mode', () => {
  it('hides near and almost tiers', () => {
    const pantry = ['gin', 'lemon_juice', 'simple_syrup']; // would near-match gimlet
    const results = matchRecipes(pantry, { strict: true }, data);
    const gimlet = results.find((r) => r.recipe.id === 'gimlet');
    expect(gimlet).toBeUndefined();
  });
});

describe('matcher — classics-only mode', () => {
  // Fixture with one IBA recipe and one huggingface-sourced recipe that share
  // the same pantry requirement. classicsOnly should retain only the IBA one.
  const mixedRecipes: Recipe[] = [
    ...recipes,
    {
      id: 'obscure_hf',
      name: 'Obscure HF Candidate',
      family: 'sour',
      method: 'shake',
      glass: 'coupe',
      instructions: '',
      source: 'huggingface',
      ingredients: [
        { ingredientId: 'gin', amountMl: 60, amountDisplay: '2 oz', position: 1 },
        { ingredientId: 'lime_juice', amountMl: 22, amountDisplay: '0.75 oz', position: 2 },
        { ingredientId: 'simple_syrup', amountMl: 15, amountDisplay: '0.5 oz', position: 3 },
      ],
    },
  ];
  const mixedData = buildDataIndex(ingredients, aliases, substitutes, mixedRecipes);

  it('excludes huggingface-sourced recipes when classicsOnly is true', () => {
    const pantry = ['gin', 'lime_juice', 'simple_syrup'];
    const all = matchRecipes(pantry, {}, mixedData);
    const classics = matchRecipes(pantry, { classicsOnly: true }, mixedData);

    expect(all.find((r) => r.recipe.id === 'obscure_hf')).toBeDefined();
    expect(classics.find((r) => r.recipe.id === 'obscure_hf')).toBeUndefined();
    // IBA gimlet should still be present
    expect(classics.find((r) => r.recipe.id === 'gimlet')?.tier).toBe('exact');
  });

  it('ranks IBA above huggingface when both match exactly', () => {
    const pantry = ['gin', 'lime_juice', 'simple_syrup'];
    const results = matchRecipes(pantry, {}, mixedData);
    const gimletIdx = results.findIndex((r) => r.recipe.id === 'gimlet');
    const hfIdx = results.findIndex((r) => r.recipe.id === 'obscure_hf');
    expect(gimletIdx).toBeGreaterThanOrEqual(0);
    expect(hfIdx).toBeGreaterThanOrEqual(0);
    expect(gimletIdx).toBeLessThan(hfIdx);
  });
});

describe('groupByTier', () => {
  it('separates results into three buckets', () => {
    const pantry = ['gin', 'lemon_juice', 'simple_syrup', 'tonic_water'];
    const results = matchRecipes(pantry, {}, data);
    const groups = groupByTier(results);
    expect(groups.exact.length + groups.near.length + groups.almost.length).toBe(
      results.length,
    );
  });
});

describe('matcher — empty pantry', () => {
  it('returns no matches for an empty pantry', () => {
    const results = matchRecipes([], {}, data);
    expect(results.filter((r) => r.tier === 'exact')).toHaveLength(0);
    expect(results.filter((r) => r.tier === 'near')).toHaveLength(0);
  });
});

describe('matcher — real seed data smoke test', () => {
  it('finds multiple matches for a well-stocked bar', async () => {
    const { DATA } = await import('../data');
    const pantry = [
      'gin_london_dry',
      'vermouth_dry',
      'vermouth_sweet',
      'campari',
      'lime_juice',
      'lemon_juice',
      'simple_syrup',
      'bourbon',
      'angostura_bitters',
      'sugar_cube',
      'water',
    ];
    const results = matchRecipes(pantry, {}, DATA);
    const exacts = results.filter((r) => r.tier === 'exact');
    // Should nail: Martini, Old Fashioned, Negroni, Tom Collins (if all ingredients present), Whiskey Sour (optional egg)
    expect(exacts.length).toBeGreaterThanOrEqual(4);
    const exactIds = exacts.map((r) => r.recipe.id);
    expect(exactIds).toContain('old_fashioned');
    expect(exactIds).toContain('negroni');
  });
});
