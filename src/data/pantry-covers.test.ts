import { describe, it, expect } from 'vitest';
import { pantryCovers } from './pantry-covers';
import { buildDataIndex } from './index';
import type { Ingredient } from '../types';

const ingredients: Ingredient[] = [
  { id: 'spirit',         name: 'Spirit',         category: 'spirit' },
  { id: 'gin',            name: 'Gin',             category: 'spirit', parentId: 'spirit' },
  { id: 'gin_london_dry', name: 'London Dry Gin',  category: 'spirit', parentId: 'gin' },
  { id: 'vodka',          name: 'Vodka',           category: 'spirit', parentId: 'spirit' },
  { id: 'campari',        name: 'Campari',         category: 'bitter' },
];
const data = buildDataIndex(ingredients, [], [], []);

describe('pantryCovers', () => {
  it('returns true for a direct match', () => {
    expect(pantryCovers('gin', new Set(['gin']), data)).toBe(true);
  });

  it('returns false when ingredient is absent', () => {
    expect(pantryCovers('campari', new Set(['gin']), data)).toBe(false);
  });

  it('returns false for empty pantry', () => {
    expect(pantryCovers('gin', new Set(), data)).toBe(false);
  });

  it('pantry parent covers recipe child (ancestor path)', () => {
    // User has generic "gin"; recipe requires "gin_london_dry".
    expect(pantryCovers('gin_london_dry', new Set(['gin']), data)).toBe(true);
  });

  it('pantry grandparent covers recipe grandchild', () => {
    // User has "spirit"; recipe requires "gin_london_dry".
    expect(pantryCovers('gin_london_dry', new Set(['spirit']), data)).toBe(true);
  });

  it('pantry child covers recipe parent (descendant path)', () => {
    // User has "gin_london_dry"; recipe requires generic "gin".
    expect(pantryCovers('gin', new Set(['gin_london_dry']), data)).toBe(true);
  });

  it('pantry grandchild covers recipe grandparent', () => {
    // User has "gin_london_dry"; recipe requires "spirit".
    expect(pantryCovers('spirit', new Set(['gin_london_dry']), data)).toBe(true);
  });

  it('sibling does NOT cover sibling', () => {
    // "vodka" and "gin" share "spirit" as parent — they do not cover each other.
    expect(pantryCovers('vodka', new Set(['gin']), data)).toBe(false);
    expect(pantryCovers('gin', new Set(['vodka']), data)).toBe(false);
  });
});
