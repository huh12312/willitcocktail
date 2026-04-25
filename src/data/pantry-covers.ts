import type { DataIndex } from './index';

/**
 * Returns true when `pantry` covers `ingredientId` — either directly, via a
 * descendant (child satisfies parent recipe call) or via an ancestor (generic
 * pantry entry satisfies a more-specific recipe call, e.g. "gin" covers
 * "London Dry Gin").
 *
 * Single source of truth for hierarchy-aware pantry coverage. Previously
 * duplicated independently in matcher, RecipeModal, and tools.check_pantry.
 */
export function pantryCovers(
  ingredientId: string,
  pantry: ReadonlySet<string>,
  data: DataIndex,
): boolean {
  if (pantry.has(ingredientId)) return true;
  const descs = data.descendants.get(ingredientId);
  if (descs) {
    for (const d of descs) if (pantry.has(d)) return true;
  }
  const ancs = data.ancestors.get(ingredientId);
  if (ancs) {
    for (const a of ancs) if (pantry.has(a)) return true;
  }
  return false;
}
