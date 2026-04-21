export type IngredientCategory =
  | 'spirit'
  | 'liqueur'
  | 'mixer'
  | 'juice'
  | 'bitter'
  | 'syrup'
  | 'wine'
  | 'garnish'
  | 'other';

export type CocktailFamily =
  | 'sour'
  | 'highball'
  | 'old_fashioned'
  | 'spritz'
  | 'martini'
  | 'flip'
  | 'fizz'
  | 'julep'
  | 'other';

export type Method = 'shake' | 'stir' | 'build' | 'blend' | 'throw';

export type Glass =
  | 'coupe'
  | 'rocks'
  | 'highball'
  | 'collins'
  | 'martini'
  | 'nick_and_nora'
  | 'wine'
  | 'flute'
  | 'julep'
  | 'hurricane';

export interface Ingredient {
  id: string;
  name: string;
  category: IngredientCategory;
  parentId?: string;
}

export interface IngredientAlias {
  alias: string;
  ingredientId: string;
}

export interface Substitute {
  ingredientId: string;
  substituteId: string;
  strength: number; // 0..1
  notes?: string;
}

export interface RecipeIngredient {
  ingredientId: string;
  amountMl?: number;
  amountDisplay: string;
  optional?: boolean;
  position: number;
  notes?: string;
}

export interface Recipe {
  id: string;
  name: string;
  family: CocktailFamily;
  method: Method;
  glass: Glass;
  garnish?: string;
  instructions: string;
  abv?: number;
  ingredients: RecipeIngredient[];
  ibaOfficial?: boolean;
  source: 'iba' | 'cocktaildb' | 'cocktailfyi' | 'generated' | 'user' | 'huggingface';
}

export type MatchTier = 'exact' | 'near' | 'almost';

export interface MatchSubstitution {
  originalId: string;
  useId: string;
  strength: number;
}

export interface MatchResult {
  recipe: Recipe;
  tier: MatchTier;
  substitutions: MatchSubstitution[];
  missing: string[]; // ingredient ids the user is missing (for near/almost)
  score: number;
}
