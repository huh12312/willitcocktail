import type { Ingredient, IngredientAlias, Recipe, Substitute } from '../types';
import { INGREDIENTS, INGREDIENT_ALIASES, SUBSTITUTES } from './ingredients';
import { RECIPES } from './recipes';

export { INGREDIENTS, INGREDIENT_ALIASES, SUBSTITUTES, RECIPES };

export interface DataIndex {
  ingredients: Ingredient[];
  ingredientById: Map<string, Ingredient>;
  aliases: IngredientAlias[];
  aliasMap: Map<string, string>; // lowercased alias -> ingredient id
  substitutes: Substitute[];
  substitutesOf: Map<string, Substitute[]>; // ingredient id -> list of its substitutes
  recipes: Recipe[];
  // For hierarchy: map of ingredientId -> Set of descendant ids (self + children recursively)
  descendants: Map<string, Set<string>>;
  // ancestors: ingredientId -> Set of ancestor ids (self + parent chain up to root)
  ancestors: Map<string, Set<string>>;
}

function buildHierarchy(
  ingredients: Ingredient[],
  ingredientById: Map<string, Ingredient>,
): {
  descendants: Map<string, Set<string>>;
  ancestors: Map<string, Set<string>>;
} {
  const childrenOf = new Map<string, string[]>();
  for (const i of ingredients) {
    if (i.parentId) {
      const arr = childrenOf.get(i.parentId) ?? [];
      arr.push(i.id);
      childrenOf.set(i.parentId, arr);
    }
  }

  const descendants = new Map<string, Set<string>>();
  function collectDescendants(id: string): Set<string> {
    const cached = descendants.get(id);
    if (cached) return cached;
    const set = new Set<string>([id]);
    const kids = childrenOf.get(id) ?? [];
    for (const k of kids) {
      for (const d of collectDescendants(k)) set.add(d);
    }
    descendants.set(id, set);
    return set;
  }
  for (const i of ingredients) collectDescendants(i.id);

  // Use the O(1) map lookup instead of ingredients.find() to avoid O(n²) total.
  const ancestors = new Map<string, Set<string>>();
  for (const i of ingredients) {
    const set = new Set<string>([i.id]);
    let cursor: Ingredient | undefined = i;
    while (cursor?.parentId) {
      set.add(cursor.parentId);
      cursor = ingredientById.get(cursor.parentId);
    }
    ancestors.set(i.id, set);
  }

  return { descendants, ancestors };
}

export function buildDataIndex(
  ingredients: Ingredient[] = INGREDIENTS,
  aliases: IngredientAlias[] = INGREDIENT_ALIASES,
  substitutes: Substitute[] = SUBSTITUTES,
  recipes: Recipe[] = RECIPES,
): DataIndex {
  const ingredientById = new Map(ingredients.map((i) => [i.id, i]));
  const aliasMap = new Map(aliases.map((a) => [a.alias.toLowerCase(), a.ingredientId]));
  const substitutesOf = new Map<string, Substitute[]>();
  for (const s of substitutes) {
    const arr = substitutesOf.get(s.ingredientId) ?? [];
    arr.push(s);
    substitutesOf.set(s.ingredientId, arr);
  }
  const { descendants, ancestors } = buildHierarchy(ingredients, ingredientById);

  return {
    ingredients,
    ingredientById,
    aliases,
    aliasMap,
    substitutes,
    substitutesOf,
    recipes,
    descendants,
    ancestors,
  };
}

export const DATA = buildDataIndex();
