import type { DataIndex } from './index';
import type { Ingredient, Recipe } from '../types';

/** Walks up the parent chain to the top-level spirit (e.g. bourbon → whiskey). */
export function rootSpirit(ingredient: Ingredient, data: DataIndex): Ingredient | null {
  if (ingredient.category !== 'spirit') return null;
  let cursor: Ingredient | undefined = ingredient;
  while (cursor?.parentId) {
    const parent = data.ingredientById.get(cursor.parentId);
    if (!parent || parent.category !== 'spirit') break;
    cursor = parent;
  }
  return cursor ?? null;
}

/** The dominant spirit in a recipe, resolved to its root category. */
export function keyLiquor(recipe: Recipe, data: DataIndex): Ingredient | null {
  let best: { root: Ingredient; ml: number } | null = null;
  for (const ri of recipe.ingredients) {
    const ing = data.ingredientById.get(ri.ingredientId);
    if (!ing) continue;
    const root = rootSpirit(ing, data);
    if (!root) continue;
    const ml = ri.amountMl ?? 0;
    if (!best || ml > best.ml) best = { root, ml };
  }
  return best?.root ?? null;
}

/** All (ingredient, count) pairs for the dominant spirit across a recipe list, sorted descending. */
export function liquorCounts(
  recipes: Recipe[],
  data: DataIndex,
): { ingredient: Ingredient; count: number }[] {
  const counts = new Map<string, { ingredient: Ingredient; count: number }>();
  for (const r of recipes) {
    const liq = keyLiquor(r, data);
    if (!liq) continue;
    const entry = counts.get(liq.id);
    if (entry) entry.count += 1;
    else counts.set(liq.id, { ingredient: liq, count: 1 });
  }
  return Array.from(counts.values()).sort((a, b) => b.count - a.count);
}
