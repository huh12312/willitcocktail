// Flavor tag lookup for the recipe seed. Kept in TS (not SQLite) because
// tags are curation metadata that evolves independently of the core corpus;
// a fresh DB build should not clobber hand-tuned tags.
//
// Tag vocabulary matches approach.md §7 constrained-decoding enum.

export const FLAVOR_TAGS = [
  'refreshing',
  'herbaceous',
  'citrus',
  'smoky',
  'bitter',
  'sweet',
  'spirit_forward',
  'creamy',
  'tropical',
  'spicy',
] as const;

export type FlavorTag = (typeof FLAVOR_TAGS)[number];

export const RECIPE_TAGS: Record<string, FlavorTag[]> = {
  // Sours
  daiquiri: ['refreshing', 'citrus'],
  margarita: ['refreshing', 'citrus'],
  whiskey_sour: ['citrus', 'sweet'],
  sidecar: ['citrus', 'spirit_forward'],
  gimlet: ['refreshing', 'citrus'],
  cosmopolitan: ['citrus', 'sweet'],
  kamikaze: ['citrus'],
  caipirinha: ['refreshing', 'citrus'],
  pisco_sour: ['citrus', 'creamy'],
  white_lady: ['citrus', 'spirit_forward'],
  hemingway_daiquiri: ['refreshing', 'citrus', 'bitter'],
  last_word: ['herbaceous', 'citrus'],
  corpse_reviver_2: ['citrus', 'herbaceous'],
  mai_tai: ['tropical', 'citrus'],
  espresso_martini: ['bitter', 'sweet'],

  // Highballs
  gin_tonic: ['refreshing', 'bitter'],
  moscow_mule: ['refreshing', 'spicy'],
  dark_stormy: ['spicy', 'refreshing'],
  paloma: ['refreshing', 'citrus', 'bitter'],
  mojito: ['refreshing', 'herbaceous', 'citrus'],
  cuba_libre: ['refreshing', 'sweet'],
  tom_collins: ['refreshing', 'citrus'],
  americano: ['bitter', 'refreshing'],
  bloody_mary: ['spicy', 'refreshing'],

  // Old Fashioned family
  old_fashioned: ['spirit_forward', 'bitter'],
  sazerac: ['spirit_forward', 'herbaceous'],
  black_russian: ['spirit_forward', 'sweet'],
  white_russian: ['creamy', 'sweet'],

  // Martini family
  dry_martini: ['spirit_forward', 'herbaceous'],
  manhattan: ['spirit_forward', 'sweet'],
  negroni: ['bitter', 'spirit_forward', 'herbaceous'],
  boulevardier: ['bitter', 'spirit_forward'],
  rob_roy: ['spirit_forward', 'sweet'],
  vesper: ['spirit_forward'],
  martinez: ['spirit_forward', 'sweet', 'herbaceous'],

  // Spritz
  aperol_spritz: ['refreshing', 'bitter', 'citrus'],
  campari_spritz: ['refreshing', 'bitter'],

  // Fizz
  gin_fizz: ['refreshing', 'citrus'],
  silver_fizz: ['refreshing', 'citrus', 'creamy'],
  french_75: ['refreshing', 'citrus'],

  // Julep
  mint_julep: ['herbaceous', 'refreshing', 'spirit_forward'],

  // Flip
  brandy_flip: ['creamy', 'sweet'],
  grasshopper: ['creamy', 'sweet', 'herbaceous'],
  alexander: ['creamy', 'sweet'],
};

export function tagsFor(recipeId: string): FlavorTag[] {
  return RECIPE_TAGS[recipeId] ?? [];
}
