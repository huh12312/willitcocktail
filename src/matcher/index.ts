import type { MatchResult, MatchSubstitution, Recipe } from '../types';
import type { DataIndex } from '../data';
import { pantryCovers } from '../data/pantry-covers';

export interface MatchOptions {
  strict?: boolean; // only exact matches
  minSubstituteStrength?: number; // default 0.7
  nearMatchLimit?: number; // how many ingredients may be swapped; default 1
  classicsOnly?: boolean; // hide unreviewed/generated sources (e.g. huggingface imports)
}

const DEFAULT_MIN_STRENGTH = 0.7;

// Source weighting: curated sources rank above imported noise. Generated
// candidates get nothing — they're meant to be saved to the `user` source
// after inspection.
const SOURCE_BONUS: Record<Recipe['source'], number> = {
  iba: 100,
  user: 70,
  cocktaildb: 50,
  cocktailfyi: 50,
  huggingface: 0,
  generated: 0,
};

// Classics-only = curated human sources. Huggingface imports are unreviewed
// and generated recipes are ephemeral candidates.
const CLASSIC_SOURCES: ReadonlySet<Recipe['source']> = new Set([
  'iba',
  'user',
  'cocktaildb',
  'cocktailfyi',
]);

function isClassic(recipe: Recipe): boolean {
  return recipe.ibaOfficial === true || CLASSIC_SOURCES.has(recipe.source);
}

/**
 * Does the pantry contain a usable substitute for this recipe ingredient?
 * Returns the best substitution if so.
 */
function findBestSubstitute(
  recipeIngredientId: string,
  pantry: Set<string>,
  data: DataIndex,
  minStrength: number,
): MatchSubstitution | null {
  const subs = data.substitutesOf.get(recipeIngredientId) ?? [];
  let best: MatchSubstitution | null = null;
  for (const s of subs) {
    if (s.strength < minStrength) continue;
    if (pantryCovers(s.substituteId, pantry, data)) {
      if (!best || s.strength > best.strength) {
        best = {
          originalId: recipeIngredientId,
          useId: s.substituteId,
          strength: s.strength,
        };
      }
    }
  }
  return best;
}

interface RecipeEvaluation {
  recipe: Recipe;
  covered: string[];
  missing: string[]; // non-optional ingredients not directly in pantry
  substitutions: MatchSubstitution[]; // attempted substitutions (only filled for near-match)
  unresolved: string[]; // ingredients we couldn't cover even with a substitute
}

function evaluate(
  recipe: Recipe,
  pantry: Set<string>,
  data: DataIndex,
  minStrength: number,
): RecipeEvaluation {
  const covered: string[] = [];
  const missing: string[] = [];
  for (const ri of recipe.ingredients) {
    if (ri.optional) {
      // optional: doesn't matter for makeability
      continue;
    }
    if (pantryCovers(ri.ingredientId, pantry, data)) {
      covered.push(ri.ingredientId);
    } else {
      missing.push(ri.ingredientId);
    }
  }
  // Try to resolve missing with substitutes
  const substitutions: MatchSubstitution[] = [];
  const unresolved: string[] = [];
  for (const m of missing) {
    const sub = findBestSubstitute(m, pantry, data, minStrength);
    if (sub) substitutions.push(sub);
    else unresolved.push(m);
  }
  return { recipe, covered, missing, substitutions, unresolved };
}

function recipeRank(recipe: Recipe): number {
  // Higher is better. Source bonus dominates; ibaOfficial stacks; ties broken
  // by ingredient count (shorter = more accessible).
  let score = SOURCE_BONUS[recipe.source] ?? 0;
  if (recipe.ibaOfficial) score += 50;
  score -= recipe.ingredients.length;
  return score;
}

export function matchRecipes(
  pantryIds: Iterable<string>,
  options: MatchOptions = {},
  data: DataIndex,
): MatchResult[] {
  const pantry = new Set(pantryIds);
  const minStrength = options.minSubstituteStrength ?? DEFAULT_MIN_STRENGTH;
  const nearLimit = options.nearMatchLimit ?? 1;

  const results: MatchResult[] = [];

  for (const recipe of data.recipes) {
    if (options.classicsOnly && !isClassic(recipe)) continue;
    const evalResult = evaluate(recipe, pantry, data, minStrength);

    if (evalResult.missing.length === 0) {
      // Tier 1: exact
      results.push({
        recipe,
        tier: 'exact',
        substitutions: [],
        missing: [],
        score: 1000 + recipeRank(recipe),
      });
      continue;
    }

    if (options.strict) continue;

    // Tier 2: near match — all missing resolved via substitutes, up to nearLimit
    if (evalResult.unresolved.length === 0 && evalResult.missing.length <= nearLimit) {
      // Average substitute strength affects score
      const avgStrength =
        evalResult.substitutions.reduce((s, x) => s + x.strength, 0) /
        evalResult.substitutions.length;
      results.push({
        recipe,
        tier: 'near',
        substitutions: evalResult.substitutions,
        missing: [],
        score: 500 + avgStrength * 100 + recipeRank(recipe),
      });
      continue;
    }

    // Tier 3: almost — exactly one unresolved missing ingredient, no usable substitute
    if (evalResult.missing.length === 1 && evalResult.unresolved.length === 1) {
      results.push({
        recipe,
        tier: 'almost',
        substitutions: [],
        missing: evalResult.unresolved,
        score: 100 + recipeRank(recipe),
      });
    }
  }

  // Rank by score desc
  results.sort((a, b) => b.score - a.score);
  return results;
}

// Module-level cache: WeakMap<DataIndex, Map<serialisedPantry, MatchResult[]>>.
// The DataIndex reference is stable within a session (loaded once from SQLite);
// the pantry string changes only when the user modifies their pantry.
const _matchCache = new WeakMap<object, Map<string, MatchResult[]>>();

/** Cached variant of matchRecipes with default options. Avoids re-running the
 *  full O(recipes × pantry) pass multiple times per Ask query when the same
 *  pantry and data are used across providers and mappers. */
export function matchRecipesMemo(pantryIds: string[], data: DataIndex): MatchResult[] {
  let byData = _matchCache.get(data);
  if (!byData) {
    byData = new Map();
    _matchCache.set(data, byData);
  }
  const key = pantryIds.join('\0');
  let cached = byData.get(key);
  if (!cached) {
    cached = matchRecipes(pantryIds, {}, data);
    byData.set(key, cached);
  }
  return cached;
}

export function groupByTier(results: MatchResult[]): {
  exact: MatchResult[];
  near: MatchResult[];
  almost: MatchResult[];
} {
  return {
    exact: results.filter((r) => r.tier === 'exact'),
    near: results.filter((r) => r.tier === 'near'),
    almost: results.filter((r) => r.tier === 'almost'),
  };
}
