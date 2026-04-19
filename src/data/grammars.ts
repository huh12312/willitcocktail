import type { CocktailFamily, Glass, IngredientCategory, Method, Recipe } from '../types';
import type { DataIndex } from './index';

// Per-family grammars used by the generation layer. The grammars are data only
// (no functions) so the same shapes can feed a deterministic TS generator AND
// later be rendered into an LLM system prompt for the polish pass.
//
// A slot is satisfied by a pantry ingredient when:
//   - the ingredient id (or any of its ancestors) is in `acceptIds`, OR
//   - the ingredient's category is in `acceptCategories`
// and the ingredient id (including ancestors) is NOT in `excludeIds`.

export interface SlotAmount {
  minMl?: number;
  maxMl?: number;
  display?: string; // for non-liquid slots ("1 egg white", "2 dashes")
}

export interface GrammarSlot {
  role: SlotRole;
  required: boolean;
  acceptIds?: string[];
  acceptCategories?: IngredientCategory[];
  excludeIds?: string[];
  amount: SlotAmount;
  notes?: string;
}

export type SlotRole =
  | 'base'
  | 'modifier'
  | 'citrus'
  | 'sweetener'
  | 'accent'
  | 'sparkling'
  | 'bitter'
  | 'bitters'
  | 'herb'
  | 'top'
  | 'cream'
  | 'egg'
  | 'ice_mixer';

export interface FamilyGrammar {
  family: CocktailFamily;
  method: Method;
  glass: Glass;
  totalVolumeMl: { min: number; max: number };
  slots: GrammarSlot[];
  balance: {
    description: string;
    ratios?: Partial<Record<SlotRole, number>>; // rough target ratios for validator
  };
  methodTemplate: string; // rendered into Recipe.instructions by generator
}

// Sets used in more than one grammar. Kept explicit (no category fallback) so
// the generator only samples drink-appropriate items. Cocktail families are
// narrow by tradition — a "sour" does not want tomato juice.
const CITRUS_JUICES = ['lime_juice', 'lemon_juice', 'grapefruit_juice'];

const SIMPLE_SWEETENERS = [
  'simple_syrup',
  'gomme_syrup',
  'honey_syrup',
  'agave_syrup',
  'orgeat',
  'falernum',
  'grenadine',
  'raspberry_syrup',
];

// Liqueurs sweet enough to stand in as the sweetener in a sour/side-car shape.
const SWEET_LIQUEURS = [
  'cointreau',
  'triple_sec',
  'grand_marnier',
  'curacao_orange',
  'maraschino',
  'kahlua',
  'creme_de_cassis',
  'creme_de_menthe_white',
  'creme_de_menthe_green',
  'creme_de_cacao_white',
  'creme_de_cacao_dark',
  'elderflower_liqueur',
  'chartreuse_yellow',
  'benedictine',
  'drambuie',
  'sambuca',
];

const BITTER_LIQUEURS = ['campari', 'aperol', 'cynar', 'fernet_branca', 'amaro_nonino'];

const AROMATISED_WINES = ['vermouth_dry', 'vermouth_sweet', 'vermouth_bianco', 'lillet_blanc'];

const SPARKLING_WINES = ['prosecco', 'champagne', 'sparkling_wine'];

const HIGHBALL_MIXERS = [
  'tonic_water',
  'soda_water',
  'ginger_beer',
  'ginger_ale',
  'cola',
  'lemon_lime_soda',
];

const BITTERS_IDS = [
  'angostura_bitters',
  'orange_bitters',
  'peychauds_bitters',
  'chocolate_bitters',
];

const FRESH_HERBS = ['mint_leaves', 'basil', 'rosemary', 'thyme', 'sage', 'cilantro'];

export const GRAMMARS: FamilyGrammar[] = [
  {
    family: 'sour',
    method: 'shake',
    glass: 'coupe',
    totalVolumeMl: { min: 75, max: 140 },
    slots: [
      { role: 'base', required: true, acceptCategories: ['spirit'], amount: { minMl: 40, maxMl: 60 } },
      { role: 'citrus', required: true, acceptIds: CITRUS_JUICES, amount: { minMl: 15, maxMl: 30 } },
      {
        role: 'sweetener',
        required: true,
        acceptIds: [...SIMPLE_SWEETENERS, ...SWEET_LIQUEURS],
        amount: { minMl: 10, maxMl: 22 },
      },
      {
        role: 'accent',
        required: false,
        acceptIds: [...SWEET_LIQUEURS, 'chartreuse_green', 'absinthe'],
        amount: { minMl: 5, maxMl: 15 },
      },
      { role: 'egg', required: false, acceptIds: ['egg_white'], amount: { display: '1 egg white' } },
    ],
    balance: {
      description: '~2:1:1 spirit:citrus:sweet',
      ratios: { base: 2, citrus: 1, sweetener: 1 },
    },
    methodTemplate:
      'Shake all ingredients hard with ice and double strain into a chilled {glass}.',
  },
  {
    family: 'highball',
    method: 'build',
    glass: 'highball',
    totalVolumeMl: { min: 150, max: 280 },
    slots: [
      { role: 'base', required: true, acceptCategories: ['spirit'], amount: { minMl: 40, maxMl: 60 } },
      { role: 'citrus', required: false, acceptIds: CITRUS_JUICES, amount: { minMl: 10, maxMl: 20 } },
      { role: 'top', required: true, acceptIds: HIGHBALL_MIXERS, amount: { minMl: 90, maxMl: 180 } },
    ],
    balance: {
      description: '~1:3 spirit:mixer',
      ratios: { base: 1, top: 3 },
    },
    methodTemplate: 'Build over ice in a highball glass and top with {top}.',
  },
  {
    family: 'old_fashioned',
    method: 'stir',
    glass: 'rocks',
    totalVolumeMl: { min: 60, max: 90 },
    slots: [
      { role: 'base', required: true, acceptCategories: ['spirit'], amount: { minMl: 55, maxMl: 60 } },
      {
        role: 'sweetener',
        required: true,
        acceptIds: [...SIMPLE_SWEETENERS, 'sugar_cube', 'sugar', ...SWEET_LIQUEURS],
        amount: { minMl: 5, maxMl: 10 },
      },
      { role: 'bitters', required: true, acceptIds: BITTERS_IDS, amount: { display: '2 dashes' } },
      {
        role: 'accent',
        required: false,
        acceptIds: ['absinthe', ...SWEET_LIQUEURS],
        amount: { minMl: 2, maxMl: 5 },
        notes: 'rinse',
      },
    ],
    balance: { description: 'spirit-forward, ~60ml base with minimal sweetener + bitters' },
    methodTemplate:
      'Stir sweetener and bitters with a splash of water until dissolved. Add {base} and a large ice cube; stir to chill.',
  },
  {
    family: 'martini',
    method: 'stir',
    glass: 'coupe',
    totalVolumeMl: { min: 60, max: 100 },
    slots: [
      { role: 'base', required: true, acceptCategories: ['spirit'], amount: { minMl: 40, maxMl: 60 } },
      {
        role: 'modifier',
        required: true,
        acceptIds: [...AROMATISED_WINES, ...BITTER_LIQUEURS],
        amount: { minMl: 10, maxMl: 30 },
      },
      {
        role: 'accent',
        required: false,
        acceptIds: [...SWEET_LIQUEURS, 'campari', 'aperol'],
        amount: { minMl: 5, maxMl: 15 },
      },
      { role: 'bitters', required: false, acceptIds: BITTERS_IDS, amount: { display: '1 dash' } },
    ],
    balance: {
      description: '~2-3:1 base:modifier, stirred spirit-forward',
      ratios: { base: 2, modifier: 1 },
    },
    methodTemplate: 'Stir all ingredients with ice until very cold and strain into a chilled {glass}.',
  },
  {
    family: 'spritz',
    method: 'build',
    glass: 'wine',
    totalVolumeMl: { min: 150, max: 240 },
    slots: [
      { role: 'sparkling', required: true, acceptIds: SPARKLING_WINES, amount: { minMl: 75, maxMl: 120 } },
      { role: 'bitter', required: true, acceptIds: BITTER_LIQUEURS, amount: { minMl: 45, maxMl: 75 } },
      { role: 'top', required: false, acceptIds: ['soda_water'], amount: { minMl: 15, maxMl: 45 } },
    ],
    balance: {
      description: '3:2:1 sparkling:bitter:soda',
      ratios: { sparkling: 3, bitter: 2, top: 1 },
    },
    methodTemplate: 'Fill a wine glass with ice. Add {sparkling}, then {bitter}, then a splash of soda. Stir gently.',
  },
  {
    family: 'fizz',
    method: 'shake',
    glass: 'highball',
    totalVolumeMl: { min: 120, max: 220 },
    slots: [
      { role: 'base', required: true, acceptCategories: ['spirit'], amount: { minMl: 40, maxMl: 50 } },
      { role: 'citrus', required: true, acceptIds: CITRUS_JUICES, amount: { minMl: 20, maxMl: 30 } },
      { role: 'sweetener', required: true, acceptIds: SIMPLE_SWEETENERS, amount: { minMl: 10, maxMl: 15 } },
      { role: 'egg', required: false, acceptIds: ['egg_white'], amount: { display: '1 egg white' } },
      {
        role: 'top',
        required: true,
        acceptIds: ['soda_water', ...SPARKLING_WINES],
        amount: { minMl: 45, maxMl: 90 },
      },
    ],
    balance: {
      description: 'sour + soda, long format',
      ratios: { base: 2, citrus: 1, sweetener: 1 },
    },
    methodTemplate:
      'Shake {base}, {citrus}, and {sweetener} (plus egg white if present) hard with ice. Strain into a highball with ice and top with soda.',
  },
  {
    family: 'flip',
    method: 'shake',
    glass: 'coupe',
    totalVolumeMl: { min: 60, max: 120 },
    slots: [
      {
        role: 'base',
        required: true,
        acceptCategories: ['spirit', 'wine', 'liqueur'],
        amount: { minMl: 30, maxMl: 60 },
      },
      {
        role: 'modifier',
        required: false,
        acceptCategories: ['liqueur'],
        amount: { minMl: 15, maxMl: 30 },
      },
      { role: 'sweetener', required: false, acceptIds: SIMPLE_SWEETENERS, amount: { minMl: 5, maxMl: 10 } },
      { role: 'cream', required: false, acceptIds: ['cream', 'milk', 'coconut_cream'], amount: { minMl: 15, maxMl: 30 } },
      {
        role: 'egg',
        required: false,
        acceptIds: ['whole_egg', 'egg_white'],
        amount: { display: '1 whole egg' },
      },
    ],
    balance: { description: 'rich, egg-bound or cream-based dessert-style' },
    methodTemplate:
      'Dry shake (no ice) to emulsify. Wet shake with ice and double strain into a chilled coupe.',
  },
  {
    family: 'julep',
    method: 'build',
    glass: 'julep',
    totalVolumeMl: { min: 60, max: 90 },
    slots: [
      { role: 'base', required: true, acceptCategories: ['spirit'], amount: { minMl: 55, maxMl: 75 } },
      { role: 'sweetener', required: true, acceptIds: SIMPLE_SWEETENERS, amount: { minMl: 7, maxMl: 12 } },
      { role: 'herb', required: true, acceptIds: FRESH_HERBS, amount: { display: '8 leaves' } },
    ],
    balance: { description: 'spirit + sugar + herb, crushed ice, aromatic' },
    methodTemplate:
      'Gently muddle {herb} with {sweetener} in a julep cup. Add {base} and pack with crushed ice; swizzle until the cup frosts.',
  },
];

export function getGrammar(family: CocktailFamily): FamilyGrammar | undefined {
  return GRAMMARS.find((g) => g.family === family);
}

/**
 * Check whether an ingredient satisfies a grammar slot, with hierarchy awareness.
 * A pantry entry of `gin` satisfies any slot accepting the spirit category; a
 * pantry entry of `gin_london_dry` satisfies a slot with `acceptIds: ['gin']`.
 */
export function ingredientFitsSlot(
  ingredientId: string,
  slot: GrammarSlot,
  data: DataIndex,
): boolean {
  const ing = data.ingredientById.get(ingredientId);
  if (!ing) return false;

  const ancestors = data.ancestors.get(ingredientId) ?? new Set([ingredientId]);
  const descendants = data.descendants.get(ingredientId) ?? new Set([ingredientId]);

  // Exclusion: if the ingredient or any of its ancestors is excluded, reject.
  if (slot.excludeIds?.length) {
    for (const ex of slot.excludeIds) {
      if (ancestors.has(ex) || descendants.has(ex)) return false;
    }
  }

  // `acceptIds` accepts the listed ids, anything whose ancestor is listed
  // (descendant-of-accepted), and anything whose descendants include a listed
  // id (ancestor-of-accepted — a generic pantry entry covering a specific call).
  if (slot.acceptIds?.length) {
    for (const acc of slot.acceptIds) {
      if (ancestors.has(acc)) return true;
      const accDescendants = data.descendants.get(acc);
      if (accDescendants && accDescendants.has(ingredientId)) return true;
    }
  }

  if (slot.acceptCategories?.includes(ing.category)) return true;

  return false;
}

/**
 * Given a pantry, return the ingredient IDs that fit a given slot.
 */
export function pantryCandidatesForSlot(
  pantryIds: string[],
  slot: GrammarSlot,
  data: DataIndex,
): string[] {
  const out: string[] = [];
  for (const id of pantryIds) {
    if (ingredientFitsSlot(id, slot, data)) out.push(id);
  }
  return out;
}

/**
 * Produce a rough role assignment for a finished recipe's ingredients — used
 * by the validator to compute ratios when we want to sanity-check a recipe
 * (generated or seed) against its family grammar.
 */
export function roleFor(
  ingredientId: string,
  grammar: FamilyGrammar,
  data: DataIndex,
): SlotRole | undefined {
  // Prefer required slots over optional ones; prefer more-specific `acceptIds`
  // matches over broad category matches. Iterate slots in declared order.
  for (const slot of grammar.slots) {
    if (ingredientFitsSlot(ingredientId, slot, data)) return slot.role;
  }
  return undefined;
}

export function coversAllRequiredSlots(
  recipe: Recipe,
  grammar: FamilyGrammar,
  data: DataIndex,
): boolean {
  const filled = new Set<SlotRole>();
  for (const ri of recipe.ingredients) {
    const r = roleFor(ri.ingredientId, grammar, data);
    if (r) filled.add(r);
  }
  return grammar.slots.filter((s) => s.required).every((s) => filled.has(s.role));
}
