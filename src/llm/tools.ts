import type { DataIndex } from '../data';
import { pantryCovers } from '../data/pantry-covers';
import { RECIPE_TAGS, type FlavorTag } from '../data/flavor-tags';
import type { CocktailFamily, Recipe, Substitute } from '../types';

// --- Tool input/output shapes (match approach.md §7) ---

export interface SearchRecipesArgs {
  has_ingredients?: string[];
  family?: CocktailFamily;
  flavor_tags?: FlavorTag[];
  max_results?: number;
}

export interface SearchRecipesHit {
  recipe_id: string;
  name: string;
  family: CocktailFamily;
  flavor_tags: FlavorTag[];
  matched_ingredients: string[]; // from has_ingredients filter
  iba_official: boolean;
}

export interface GetRecipeResult {
  recipe_id: string;
  name: string;
  family: CocktailFamily;
  method: string;
  glass: string;
  garnish: string | null;
  instructions: string;
  iba_official: boolean;
  flavor_tags: FlavorTag[];
  ingredients: {
    ingredient_id: string;
    ingredient_name: string;
    amount_ml: number | null;
    amount_display: string;
    optional: boolean;
    notes: string | null;
    position: number;
  }[];
}

export interface GetSubstitutesResult {
  ingredient_id: string;
  ingredient_name: string | null;
  substitutes: {
    ingredient_id: string;
    ingredient_name: string | null;
    strength: number;
    notes: string | null;
  }[];
}

export interface CheckPantryResult {
  have: string[]; // ingredient IDs covered (directly or via hierarchy)
  missing: string[];
}

// --- Implementations ---

function hasIngredientCovered(
  recipe: Recipe,
  targetId: string,
  data: DataIndex,
): string | null {
  // Does the recipe list an ingredient whose canonical id is targetId, or an ancestor/descendant of it?
  const descs = data.descendants.get(targetId) ?? new Set([targetId]);
  const ancs = data.ancestors.get(targetId) ?? new Set([targetId]);
  for (const ri of recipe.ingredients) {
    if (descs.has(ri.ingredientId) || ancs.has(ri.ingredientId)) {
      return ri.ingredientId;
    }
  }
  return null;
}

export function search_recipes(
  args: SearchRecipesArgs,
  data: DataIndex,
): SearchRecipesHit[] {
  const max = args.max_results ?? 10;
  const need = args.has_ingredients ?? [];
  const wantTags = new Set<FlavorTag>(args.flavor_tags ?? []);

  type Scored = { hit: SearchRecipesHit; score: number };
  const scored: Scored[] = [];

  for (const recipe of data.recipes) {
    if (args.family && recipe.family !== args.family) continue;

    const tags = (RECIPE_TAGS[recipe.id] ?? []) as FlavorTag[];

    // Every requested ingredient must be present (hierarchy-aware).
    const matched: string[] = [];
    let ingredientsOK = true;
    for (const id of need) {
      const hit = hasIngredientCovered(recipe, id, data);
      if (!hit) {
        ingredientsOK = false;
        break;
      }
      matched.push(hit);
    }
    if (!ingredientsOK) continue;

    // Tag overlap (soft): higher match count = higher score, but don't hard-filter.
    let tagOverlap = 0;
    for (const t of tags) if (wantTags.has(t)) tagOverlap++;
    if (wantTags.size > 0 && tagOverlap === 0) continue;

    const score =
      tagOverlap * 10 +
      (recipe.ibaOfficial ? 3 : 0) +
      matched.length * 2 -
      recipe.ingredients.length * 0.1;

    scored.push({
      hit: {
        recipe_id: recipe.id,
        name: recipe.name,
        family: recipe.family,
        flavor_tags: tags,
        matched_ingredients: matched,
        iba_official: !!recipe.ibaOfficial,
      },
      score,
    });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, max).map((s) => s.hit);
}

export function get_recipe(
  recipe_id: string,
  data: DataIndex,
): GetRecipeResult | null {
  const recipe = data.recipeById.get(recipe_id);
  if (!recipe) return null;
  return {
    recipe_id: recipe.id,
    name: recipe.name,
    family: recipe.family,
    method: recipe.method,
    glass: recipe.glass,
    garnish: recipe.garnish ?? null,
    instructions: recipe.instructions,
    iba_official: !!recipe.ibaOfficial,
    flavor_tags: (RECIPE_TAGS[recipe.id] ?? []) as FlavorTag[],
    ingredients: recipe.ingredients.map((ri) => ({
      ingredient_id: ri.ingredientId,
      ingredient_name: data.ingredientById.get(ri.ingredientId)?.name ?? ri.ingredientId,
      amount_ml: ri.amountMl ?? null,
      amount_display: ri.amountDisplay,
      optional: !!ri.optional,
      notes: ri.notes ?? null,
      position: ri.position,
    })),
  };
}

export function get_substitutes(
  ingredient_id: string,
  data: DataIndex,
): GetSubstitutesResult {
  const ing = data.ingredientById.get(ingredient_id);
  const subs: Substitute[] = data.substitutesOf.get(ingredient_id) ?? [];
  const sorted = [...subs].sort((a, b) => b.strength - a.strength);
  return {
    ingredient_id,
    ingredient_name: ing?.name ?? null,
    substitutes: sorted.map((s) => ({
      ingredient_id: s.substituteId,
      ingredient_name: data.ingredientById.get(s.substituteId)?.name ?? null,
      strength: s.strength,
      notes: s.notes ?? null,
    })),
  };
}

/**
 * Check which of a set of ingredients are in the user's pantry.
 * Hierarchy-aware: if pantry has "gin", check_pantry(["gin_london_dry"]) reports it as covered.
 */
export function check_pantry(
  ingredient_ids: string[],
  pantryIds: Iterable<string>,
  data: DataIndex,
): CheckPantryResult {
  const pantry = new Set(pantryIds);
  const have: string[] = [];
  const missing: string[] = [];
  for (const id of ingredient_ids) {
    if (pantryCovers(id, pantry, data)) have.push(id);
    else missing.push(id);
  }
  return { have, missing };
}
