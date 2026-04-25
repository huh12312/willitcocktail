import type { DataIndex } from '../data';
import { matchRecipesMemo } from '../matcher';
import type { CocktailFamily } from '../types';
import type { FlavorTag } from '../data/flavor-tags';
import { RECIPE_TAGS } from '../data/flavor-tags';
import {
  FAMILY_KEYWORDS,
  TAG_KEYWORDS,
  type IntentMatch,
  type IntentSearchResult,
  type InventedRecipe,
  type LlmProvider,
  type ParsedPantry,
} from './provider';
import { check_pantry, get_recipe, search_recipes } from './tools';
import { generateCandidates } from '../generation/generator';

// Simple Levenshtein for short fuzzy matches.
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const v0 = new Array(b.length + 1);
  const v1 = new Array(b.length + 1);
  for (let i = 0; i <= b.length; i++) v0[i] = i;
  for (let i = 0; i < a.length; i++) {
    v1[0] = i + 1;
    for (let j = 0; j < b.length; j++) {
      const cost = a[i] === b[j] ? 0 : 1;
      v1[j + 1] = Math.min(v1[j] + 1, v0[j + 1] + 1, v0[j] + cost);
    }
    for (let j = 0; j <= b.length; j++) v0[j] = v1[j];
  }
  return v1[b.length];
}

function normalizePhrase(s: string): string {
  return s.toLowerCase().trim().replace(/^(some|a bit of|a splash of|half a|a little|an|a|the)\s+/i, '').replace(/\s+/g, ' ');
}

// Strip "juice" and other hedges — a user typing "lime" probably means lime juice when it's a juice ingredient.
function splitPhrases(input: string): string[] {
  return input
    .split(/[,;\n]|\band\b|\+|&|\/|\bplus\b|\bwith\b/gi)
    .map((p) => p.trim())
    .filter(Boolean);
}

export class HeuristicProvider implements LlmProvider {
  readonly id = 'heuristic';
  readonly label = 'Offline (no model)';
  readonly requiresModelDownload = false;

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async parseIngredients(input: string, data: DataIndex): Promise<ParsedPantry> {
    const resolved: ParsedPantry['resolved'] = [];
    const unresolved: string[] = [];

    for (const rawPhrase of splitPhrases(input)) {
      const phrase = normalizePhrase(rawPhrase);
      if (!phrase) continue;

      const match = this.resolvePhrase(phrase, data);
      if (match) {
        if (!resolved.some((r) => r.ingredientId === match.ingredientId)) {
          resolved.push({
            input: rawPhrase.trim(),
            ingredientId: match.ingredientId,
            ingredientName: data.ingredientById.get(match.ingredientId)?.name ?? match.ingredientId,
            confidence: match.confidence,
          });
        }
      } else {
        unresolved.push(rawPhrase.trim());
      }
    }
    return { resolved, unresolved };
  }

  private resolvePhrase(
    phrase: string,
    data: DataIndex,
  ): { ingredientId: string; confidence: number } | null {
    // 1) Direct alias hit
    const aliasHit = data.aliasMap.get(phrase);
    if (aliasHit) return { ingredientId: aliasHit, confidence: 1.0 };

    // 2) Ingredient name exact (case-insensitive)
    for (const ing of data.ingredients) {
      if (ing.name.toLowerCase() === phrase) {
        return { ingredientId: ing.id, confidence: 1.0 };
      }
    }

    // 3) Substring containment — either direction (e.g. "lime" in "lime juice", "london dry" in "london dry gin")
    const substringHits: { id: string; confidence: number }[] = [];
    for (const ing of data.ingredients) {
      const nameLower = ing.name.toLowerCase();
      if (nameLower.includes(phrase) || phrase.includes(nameLower)) {
        // Prefer shorter names (more specific match relative to the phrase)
        substringHits.push({ id: ing.id, confidence: 0.8 });
      }
    }
    // Alias substring as fallback
    for (const [alias, id] of data.aliasMap) {
      if (alias.includes(phrase) || phrase.includes(alias)) {
        substringHits.push({ id, confidence: 0.75 });
      }
    }
    if (substringHits.length > 0) {
      // Pick the best: if phrase exactly matches a parent (e.g. "gin"), return parent; else first
      const parentMatch = substringHits.find((h) => {
        const ing = data.ingredientById.get(h.id);
        return ing && !ing.parentId;
      });
      const picked = parentMatch ?? substringHits[0]!;
      return { ingredientId: picked.id, confidence: picked.confidence };
    }

    // 4) Fuzzy — Levenshtein ≤ 2 against ingredient names
    let best: { id: string; distance: number } | null = null;
    for (const ing of data.ingredients) {
      const d = levenshtein(phrase, ing.name.toLowerCase());
      if (d <= 2 && (!best || d < best.distance)) best = { id: ing.id, distance: d };
    }
    if (best) return { ingredientId: best.id, confidence: 0.6 - best.distance * 0.1 };

    return null;
  }

  async searchIntent(
    query: string,
    pantryIds: string[],
    data: DataIndex,
  ): Promise<IntentSearchResult> {
    const q = query.toLowerCase();

    // Extract tags and family hints from keyword vocabulary
    const wantedTags = new Set<FlavorTag>();
    for (const [tag, kws] of Object.entries(TAG_KEYWORDS) as [FlavorTag, string[]][]) {
      for (const kw of kws) if (q.includes(kw)) wantedTags.add(tag);
    }

    let wantedFamily: CocktailFamily | undefined;
    for (const [fam, kws] of Object.entries(FAMILY_KEYWORDS) as [CocktailFamily, string[]][]) {
      for (const kw of kws) {
        if (kw && q.includes(kw)) {
          wantedFamily = fam;
          break;
        }
      }
      if (wantedFamily) break;
    }

    // Also try to extract referenced ingredients from the query using the parser
    const parsed = await this.parseIngredients(query, data);
    const hasIngredients = parsed.resolved.map((r) => r.ingredientId);

    // Run tool-level search
    const hits = search_recipes(
      {
        has_ingredients: hasIngredients.length ? hasIngredients : undefined,
        family: wantedFamily,
        flavor_tags: wantedTags.size ? Array.from(wantedTags) : undefined,
        max_results: 20,
      },
      data,
    );

    // If tag filter was too strict (no hits), fall back to ignoring tags
    let effectiveHits = hits;
    if (hits.length === 0 && wantedTags.size > 0) {
      effectiveHits = search_recipes(
        {
          has_ingredients: hasIngredients.length ? hasIngredients : undefined,
          family: wantedFamily,
          max_results: 20,
        },
        data,
      );
    }

    // Rank by: makeability (exact > near > almost > cannot) and tag overlap
    const deterministicMatches = matchRecipesMemo(pantryIds, data);
    const matchByRecipe = new Map(deterministicMatches.map((m) => [m.recipe.id, m]));

    const intentMatches: IntentMatch[] = effectiveHits.slice(0, 15).map((hit) => {
      const det = matchByRecipe.get(hit.recipe_id);
      const tags = (RECIPE_TAGS[hit.recipe_id] ?? []) as FlavorTag[];

      let makeability: IntentMatch['makeability'] = 'cannot_make';
      let subs: IntentMatch['substitutions'] = [];
      let missing: string[] = [];

      if (det) {
        if (det.tier === 'exact') makeability = 'now';
        else if (det.tier === 'near') makeability = 'with_substitute';
        else if (det.tier === 'almost') makeability = 'missing_one';
        subs = det.substitutions.map((s) => ({ original: s.originalId, use: s.useId }));
        missing = det.missing;
      } else {
        // Recipe didn't show up in any matcher tier → user is missing more than one ingredient.
        // Compute missing via check_pantry for display.
        const recipe = data.recipes.find((r) => r.id === hit.recipe_id)!;
        const needed = recipe.ingredients.filter((ri) => !ri.optional).map((ri) => ri.ingredientId);
        const { missing: miss } = check_pantry(needed, pantryIds, data);
        missing = miss;
      }

      const recipeFull = get_recipe(hit.recipe_id, data)!;
      const fitReason = buildFitReason(hit.name, tags, wantedTags, hasIngredients, recipeFull.ingredients.map((i) => i.ingredient_id), wantedFamily, hit.family);

      return {
        recipeId: hit.recipe_id,
        recipeName: hit.name,
        fitReason,
        makeability,
        substitutions: subs,
        missing,
        tags,
      };
    });

    // Sort: makeability preference, then originalquery intent score (tag overlap implicit via search_recipes ranking)
    const makeabilityRank = { now: 0, with_substitute: 1, missing_one: 2, cannot_make: 3 };
    intentMatches.sort((a, b) => makeabilityRank[a.makeability] - makeabilityRank[b.makeability]);

    const interpretation = buildInterpretation(query, wantedTags, wantedFamily, parsed.resolved.map((r) => r.ingredientName));
    const topMatches = intentMatches.slice(0, 5);
    const notes =
      hits.length === 0 && wantedTags.size > 0
        ? 'Couldn\'t find a recipe matching those exact flavors — here are close alternatives.'
        : undefined;

    return {
      interpretation,
      matches: topMatches,
      notes,
    };
  }

  async inventFromPantry(
    _query: string,
    pantryIds: string[],
    data: DataIndex,
  ): Promise<InventedRecipe[]> {
    const candidates = generateCandidates({ pantryIds, data, seed: Date.now(), perFamily: 2 });
    return candidates.slice(0, 4).map((c) => ({
      name: c.recipe.name,
      family: c.recipe.family,
      method: c.recipe.method,
      glass: c.recipe.glass,
      garnish: c.recipe.garnish,
      instructions: c.recipe.instructions,
      ingredients: c.recipe.ingredients.map((ri) => ({
        ingredientId: ri.ingredientId,
        amountDisplay: ri.amountDisplay,
        amountMl: ri.amountMl,
        position: ri.position,
      })),
      missing: [],
      alsoNeeded: [],
    }));
  }
}

function buildFitReason(
  name: string,
  recipeTags: FlavorTag[],
  wantedTags: Set<FlavorTag>,
  wantedIngredients: string[],
  recipeIngredientIds: string[],
  wantedFamily: CocktailFamily | undefined,
  recipeFamily: CocktailFamily,
): string {
  const tagHits = recipeTags.filter((t) => wantedTags.has(t));
  const ingredientHits = wantedIngredients.filter((i) => recipeIngredientIds.includes(i));

  const parts: string[] = [];
  if (tagHits.length) parts.push(tagHits.join(' + '));
  if (ingredientHits.length) parts.push(`features ${ingredientHits.length} requested ingredient${ingredientHits.length === 1 ? '' : 's'}`);
  if (wantedFamily && wantedFamily === recipeFamily) parts.push(`${recipeFamily} family`);

  if (parts.length === 0) return `${name} is a solid classic that fits your request`;
  return `${parts.join(' · ')}`;
}

function buildInterpretation(
  query: string,
  tags: Set<FlavorTag>,
  family: CocktailFamily | undefined,
  ingredientNames: string[],
): string {
  const bits: string[] = [];
  if (tags.size) bits.push(Array.from(tags).join(' + '));
  if (family) bits.push(`${family.replace('_', ' ')} style`);
  if (ingredientNames.length) bits.push(`with ${ingredientNames.join(', ')}`);
  if (bits.length === 0) return `Looking for cocktails matching: "${query.trim()}"`;
  return `You want something ${bits.join(', ')}.`;
}
