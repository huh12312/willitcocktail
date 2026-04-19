import type { CocktailFamily, Recipe, RecipeIngredient } from '../types';
import type { DataIndex } from '../data';
import {
  GRAMMARS,
  type FamilyGrammar,
  type GrammarSlot,
  type SlotRole,
  pantryCandidatesForSlot,
} from '../data/grammars';
import { scoreCandidate, type CandidateScore } from './validator';

export interface GeneratedCandidate {
  recipe: Recipe;
  grammar: FamilyGrammar;
  filledRoles: Partial<Record<SlotRole, string>>;
  score: CandidateScore;
}

export interface GenerateOptions {
  pantryIds: string[];
  data: DataIndex;
  seed?: number;
  perFamily?: number; // how many candidates to attempt per family
  families?: CocktailFamily[];
}

// mulberry32: tiny seedable PRNG. Same seed → same sequence → deterministic output.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(arr: T[], rand: () => number): T {
  return arr[Math.floor(rand() * arr.length)]!;
}

function snapTo(value: number, step: number): number {
  return Math.round(value / step) * step;
}

function amountForSlot(slot: GrammarSlot, rand: () => number): {
  amountMl?: number;
  amountDisplay: string;
} {
  const { amount } = slot;
  if (amount.minMl !== undefined && amount.maxMl !== undefined) {
    const span = amount.maxMl - amount.minMl;
    const raw = amount.minMl + rand() * span;
    const ml = snapTo(raw, 5);
    return { amountMl: ml, amountDisplay: formatOz(ml) };
  }
  return { amountDisplay: amount.display ?? 'to taste' };
}

function formatOz(ml: number): string {
  if (ml >= 29 && ml <= 31) return '1 oz';
  if (ml >= 14 && ml <= 16) return '0.5 oz';
  if (ml >= 21 && ml <= 23) return '0.75 oz';
  if (ml >= 43 && ml <= 47) return '1.5 oz';
  if (ml >= 58 && ml <= 62) return '2 oz';
  const oz = ml / 30;
  return `${oz.toFixed(2).replace(/\.?0+$/, '')} oz`;
}

function shortHash(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

function recipeIdFor(family: CocktailFamily, ingredients: RecipeIngredient[]): string {
  const sig = ingredients
    .map((i) => `${i.ingredientId}:${i.amountMl ?? i.amountDisplay}`)
    .sort()
    .join('|');
  return `gen_${family}_${shortHash(sig)}`;
}

function renderInstructions(
  template: string,
  filled: Partial<Record<SlotRole, string>>,
  data: DataIndex,
  glass: string,
): string {
  return template.replace(/\{(\w+)\}/g, (_m, key) => {
    if (key === 'glass') return glass;
    const ingId = filled[key as SlotRole];
    if (!ingId) return key;
    return data.ingredientById.get(ingId)?.name ?? ingId;
  });
}

function guessGarnish(
  grammar: FamilyGrammar,
  filled: Partial<Record<SlotRole, string>>,
  data: DataIndex,
): string {
  const citrus = filled.citrus;
  if (citrus === 'lime_juice') return 'Lime wheel';
  if (citrus === 'lemon_juice') return 'Lemon twist';
  if (citrus === 'grapefruit_juice') return 'Grapefruit peel';
  if (grammar.family === 'julep' || filled.herb === 'mint_leaves') return 'Mint sprig';
  if (grammar.family === 'spritz') return 'Orange slice';
  if (grammar.family === 'old_fashioned' || grammar.family === 'martini') {
    const base = filled.base ? data.ingredientById.get(filled.base)?.category : undefined;
    return base === 'spirit' ? 'Orange twist' : 'Lemon twist';
  }
  return '—';
}

// Enumerate one candidate recipe per (family, seed-iteration). Caller decides
// which families to try and how many attempts each. Dedup happens at the
// caller, keyed on recipe id.
function attemptCandidate(
  grammar: FamilyGrammar,
  pantryIds: string[],
  data: DataIndex,
  rand: () => number,
): GeneratedCandidate | null {
  const filled: Partial<Record<SlotRole, string>> = {};
  const ingredients: RecipeIngredient[] = [];
  let position = 1;

  for (const slot of grammar.slots) {
    const options = pantryCandidatesForSlot(pantryIds, slot, data);
    if (options.length === 0) {
      if (slot.required) return null;
      continue;
    }
    if (!slot.required) {
      // Include optional slots roughly half the time; skews with number of
      // optional slots so we don't produce 5-ingredient sours by default.
      if (rand() < 0.4) continue;
    }

    const ingId = pick(options, rand);
    filled[slot.role] = ingId;
    const amt = amountForSlot(slot, rand);
    ingredients.push({
      ingredientId: ingId,
      amountMl: amt.amountMl,
      amountDisplay: amt.amountDisplay,
      position: position++,
      optional: false,
      notes: slot.notes,
    });
  }

  if (ingredients.length === 0) return null;

  // Avoid picking the same ingredient for two roles (e.g. bourbon as both base
  // and accent). Simple dedup: drop duplicates keeping first occurrence.
  const seen = new Set<string>();
  const unique: RecipeIngredient[] = [];
  for (const ri of ingredients) {
    if (seen.has(ri.ingredientId)) continue;
    seen.add(ri.ingredientId);
    unique.push(ri);
  }
  // Re-index positions after dedup
  unique.forEach((ri, i) => (ri.position = i + 1));

  const instructions = renderInstructions(grammar.methodTemplate, filled, data, grammar.glass);
  const garnish = guessGarnish(grammar, filled, data);
  const id = recipeIdFor(grammar.family, unique);

  const recipe: Recipe = {
    id,
    name: placeholderName(grammar.family, filled, data),
    family: grammar.family,
    method: grammar.method,
    glass: grammar.glass,
    garnish,
    instructions,
    ingredients: unique,
    source: 'generated',
    ibaOfficial: false,
  };

  const score = scoreCandidate(recipe, grammar, filled, data);

  return { recipe, grammar, filledRoles: filled, score };
}

function placeholderName(
  family: CocktailFamily,
  filled: Partial<Record<SlotRole, string>>,
  data: DataIndex,
): string {
  const baseName =
    filled.base && data.ingredientById.get(filled.base)?.name;
  const bitter = filled.bitter && data.ingredientById.get(filled.bitter)?.name;
  const sparkling = filled.sparkling && data.ingredientById.get(filled.sparkling)?.name;
  const modifier = filled.modifier && data.ingredientById.get(filled.modifier)?.name;

  const famTitle = family.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  if (family === 'spritz' && bitter) return `${bitter} Spritz`;
  if (family === 'spritz' && sparkling) return `${sparkling} Spritz`;
  if (baseName) return `${baseName} ${famTitle}`;
  if (modifier) return `${modifier} ${famTitle}`;
  return `New ${famTitle}`;
}

export function generateCandidates(opts: GenerateOptions): GeneratedCandidate[] {
  const { pantryIds, data } = opts;
  const perFamily = opts.perFamily ?? 4;
  const allowed = new Set(opts.families ?? GRAMMARS.map((g) => g.family));
  const rand = mulberry32(opts.seed ?? Date.now() & 0xffffffff);

  const out = new Map<string, GeneratedCandidate>();
  for (const grammar of GRAMMARS) {
    if (!allowed.has(grammar.family)) continue;
    let attempts = 0;
    let accepted = 0;
    // Try up to perFamily * 3 attempts to hit perFamily accepted unique candidates.
    while (accepted < perFamily && attempts < perFamily * 4) {
      attempts++;
      const cand = attemptCandidate(grammar, pantryIds, data, rand);
      if (!cand) break; // missing required slot — no point retrying this family
      if (out.has(cand.recipe.id)) continue;
      if (isSeedDuplicate(cand.recipe, data)) continue;
      out.set(cand.recipe.id, cand);
      accepted++;
    }
  }

  return [...out.values()].sort((a, b) => b.score.total - a.score.total);
}

function isSeedDuplicate(candidate: Recipe, data: DataIndex): boolean {
  const sig = candidate.ingredients
    .map((i) => i.ingredientId)
    .sort()
    .join('|');
  for (const r of data.recipes) {
    if (r.source === 'generated') continue;
    const rsig = r.ingredients
      .filter((i) => !i.optional)
      .map((i) => i.ingredientId)
      .sort()
      .join('|');
    if (rsig === sig) return true;
  }
  return false;
}
