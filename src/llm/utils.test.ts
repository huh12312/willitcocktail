import { describe, it, expect } from 'vitest';
import { sanitiseString, formatMlToOz, extractQueryIngredients } from './utils';
import { buildDataIndex } from '../data';
import type { Ingredient } from '../types';

// Small synthetic fixture — spirits hierarchy + a juice and an herb.
const ingredients: Ingredient[] = [
  { id: 'spirit',         name: 'Spirit',         category: 'spirit' },
  { id: 'gin',            name: 'Gin',             category: 'spirit', parentId: 'spirit' },
  { id: 'gin_london_dry', name: 'London Dry Gin',  category: 'spirit', parentId: 'gin' },
  { id: 'vodka',          name: 'Vodka',           category: 'spirit', parentId: 'spirit' },
  { id: 'rum',            name: 'Rum',             category: 'spirit', parentId: 'spirit' },
  { id: 'lime_juice',     name: 'Lime Juice',      category: 'juice' },
  { id: 'ginger_beer',    name: 'Ginger Beer',     category: 'mixer' },
  { id: 'basil',          name: 'Basil',           category: 'other' },
];
const data = buildDataIndex(ingredients, [{ alias: 'ldg', ingredientId: 'gin_london_dry' }], [], []);

// ---------------------------------------------------------------------------

describe('sanitiseString', () => {
  it('trims whitespace', () => {
    expect(sanitiseString('  hello  ', 'fb', 20)).toBe('hello');
  });
  it('returns fallback for empty string', () => {
    expect(sanitiseString('', 'fallback', 20)).toBe('fallback');
  });
  it('returns fallback for non-string values', () => {
    expect(sanitiseString(42, 'fallback', 20)).toBe('fallback');
    expect(sanitiseString(null, 'fallback', 20)).toBe('fallback');
    expect(sanitiseString(undefined, 'fallback', 20)).toBe('fallback');
  });
  it('truncates at maxLen', () => {
    expect(sanitiseString('hello world', 'fb', 5)).toBe('hello');
  });
  it('passes through values within maxLen', () => {
    expect(sanitiseString('hi', 'fb', 5)).toBe('hi');
  });
});

// ---------------------------------------------------------------------------

describe('formatMlToOz', () => {
  it('maps standard pours via range guards', () => {
    expect(formatMlToOz(15)).toBe('0.5 oz');
    expect(formatMlToOz(22)).toBe('0.75 oz');
    expect(formatMlToOz(30)).toBe('1 oz');
    expect(formatMlToOz(45)).toBe('1.5 oz');
    expect(formatMlToOz(60)).toBe('2 oz');
  });
  it('handles edges of range guards', () => {
    expect(formatMlToOz(14)).toBe('0.5 oz');
    expect(formatMlToOz(16)).toBe('0.5 oz');
    expect(formatMlToOz(58)).toBe('2 oz');
    expect(formatMlToOz(62)).toBe('2 oz');
  });
  it('snaps unusual values to nearest 0.25 oz', () => {
    // 75ml / 30 = 2.5 → snap to 2.5
    expect(formatMlToOz(75)).toBe('2.5 oz');
  });
});

// ---------------------------------------------------------------------------

describe('extractQueryIngredients', () => {
  it('extracts multiple ingredients from a natural-language query', () => {
    const result = extractQueryIngredients('a basil forward vodka cocktail', data);
    expect(result).toContain('vodka');
    expect(result).toContain('basil');
  });

  it('does NOT match "gin" inside "ginger beer"', () => {
    const result = extractQueryIngredients('ginger beer cocktail', data);
    expect(result).not.toContain('gin');
    expect(result).toContain('ginger_beer');
  });

  it('does NOT match "rum" inside another word', () => {
    const result = extractQueryIngredients('my favourite drummer', data);
    expect(result).not.toContain('rum');
  });

  it('is case-insensitive', () => {
    const result = extractQueryIngredients('VODKA and Lime Juice', data);
    expect(result).toContain('vodka');
    expect(result).toContain('lime_juice');
  });

  it('returns empty array when no ingredients appear', () => {
    const result = extractQueryIngredients('something fruity and refreshing', data);
    expect(result).toHaveLength(0);
  });

  it('deduplicates to parent when both parent and child match', () => {
    // "London Dry Gin" matches gin_london_dry; "Gin" (inside "London Dry Gin")
    // also matches gin. Dedup removes gin_london_dry (its parent gin was matched)
    // and keeps gin — hierarchy-aware search on gin finds LDG recipes anyway.
    const result = extractQueryIngredients('London Dry Gin sour', data);
    expect(result).toContain('gin');
    // Exactly one of gin / gin_london_dry survives (no duplicate coverage).
    expect(result.filter((id) => id === 'gin' || id === 'gin_london_dry').length).toBe(1);
  });

  it('keeps parent when no child is mentioned', () => {
    const result = extractQueryIngredients('gin sour please', data);
    expect(result).toContain('gin');
  });

  it('resolves an alias', () => {
    // "ldg" is an alias for gin_london_dry
    const result = extractQueryIngredients('make me a ldg cocktail', data);
    expect(result).toContain('gin_london_dry');
  });
});
