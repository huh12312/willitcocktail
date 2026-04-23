import type { DataIndex } from '../data';
import type { CocktailFamily, Glass, Method, Recipe } from '../types';
import type { FlavorTag } from '../data/flavor-tags';

export interface RecipePolish {
  name: string;
  garnish: string;
  instructions: string;
  reasoning: string;
}

export interface ParsedPantry {
  resolved: {
    input: string; // the literal phrase parsed
    ingredientId: string; // canonical id
    ingredientName: string;
    confidence: number; // 0..1
  }[];
  unresolved: string[]; // phrases we couldn't map
}

export interface IntentMatch {
  recipeId: string;
  recipeName: string;
  fitReason: string;
  makeability: 'now' | 'with_substitute' | 'missing_one' | 'cannot_make';
  substitutions: { original: string; use: string }[];
  missing: string[];
  tags: FlavorTag[];
  /** True when the recipe doesn't exist in the local DB — details came from the LLM. */
  llmGenerated?: boolean;
  /** Brief description provided by the LLM for llmGenerated recipes. */
  llmDescription?: string;
}

export interface IntentSearchResult {
  interpretation: string;
  matches: IntentMatch[];
  notes?: string;
}

export interface InventedRecipe {
  name: string;
  family: CocktailFamily;
  method: Method;
  glass: Glass;
  garnish?: string;
  instructions: string;
  reasoning?: string;
  /** Pantry ingredients — all ingredientIds are canonical and in the user's pantry. */
  ingredients: {
    ingredientId: string;
    amountDisplay: string;
    amountMl?: number;
    position: number;
  }[];
  /** Free-text ingredients the LLM recommends that are outside the canonical list. */
  alsoNeeded: string[];
}

export interface LlmRecipeDetails {
  ingredients: { name: string; amount: string }[];
  instructions: string;
  garnish?: string;
  glass?: string;
}

export interface LlmProvider {
  readonly id: string; // "heuristic" | "litert-lm" | "gemini-flash"
  readonly label: string; // human-readable
  readonly requiresModelDownload: boolean;
  isAvailable(): Promise<boolean>;
  parseIngredients(input: string, data: DataIndex): Promise<ParsedPantry>;
  searchIntent(
    query: string,
    pantryIds: string[],
    data: DataIndex,
  ): Promise<IntentSearchResult>;
  proposeRecipe?(candidate: Recipe, data: DataIndex): Promise<RecipePolish>;
  /** Fetch full recipe details for a named cocktail not in the local DB. */
  getLlmRecipeDetails?(name: string): Promise<LlmRecipeDetails | null>;
  /**
   * Invent novel cocktails from the user's pantry. May suggest ingredients
   * outside the canonical list via `alsoNeeded` free-text strings.
   */
  inventFromPantry?(
    query: string,
    pantryIds: string[],
    data: DataIndex,
  ): Promise<InventedRecipe[]>;
}

// Flavor tags keyed by common English vocabulary (used by heuristic)
export const TAG_KEYWORDS: Record<FlavorTag, string[]> = {
  refreshing: ['refreshing', 'crisp', 'light', 'summer', 'bright', 'cool', 'hot day'],
  herbaceous: ['herbaceous', 'herbal', 'herby', 'garden', 'botanical', 'mint', 'basil'],
  citrus: ['citrus', 'citrusy', 'lemon', 'lime', 'sour', 'tart', 'zesty'],
  smoky: ['smoky', 'smoke', 'mezcal', 'peat', 'islay'],
  bitter: ['bitter', 'amaro', 'aperitivo'],
  sweet: ['sweet', 'dessert', 'sugary', 'after dinner'],
  spirit_forward: ['spirit forward', 'strong', 'boozy', 'stirred', 'neat', 'contemplative'],
  creamy: ['creamy', 'cream', 'rich', 'dessert', 'silky'],
  tropical: ['tropical', 'tiki', 'pineapple', 'coconut', 'beach'],
  spicy: ['spicy', 'spice', 'ginger', 'pepper'],
};

export const FAMILY_KEYWORDS: Record<CocktailFamily, string[]> = {
  sour: ['sour'],
  highball: ['highball', 'tall', 'long'],
  old_fashioned: ['old fashioned', 'old-fashioned', 'rocks'],
  spritz: ['spritz'],
  martini: ['martini', 'manhattan', 'negroni', 'stirred'],
  flip: ['flip', 'flipped'],
  fizz: ['fizz'],
  julep: ['julep'],
  other: [],
};
