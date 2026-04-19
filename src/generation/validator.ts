import type { Recipe } from '../types';
import type { DataIndex } from '../data';
import { type FamilyGrammar, type SlotRole, roleFor } from '../data/grammars';

export interface CandidateScore {
  total: number; // 0..1
  ratio: number; // 0..1 — how well balance matches family's ratios
  volume: number; // 0..1 — how well total volume fits glass window
  novelty: number; // 0..1 — distance from seed corpus (set to 1 since generator dedups; placeholder for fine-grain)
  balanceNotes: string[]; // human-readable issues/passes
}

/**
 * Quality-score a candidate recipe against its family grammar. Catches:
 *   - off-balance ratios (e.g. 3:1:1 sour when family wants 2:1:1)
 *   - volume outside glass window (too thin / too overflowing)
 *   - multiple sweeteners or multiple citruses (palate crowding)
 */
export function scoreCandidate(
  recipe: Recipe,
  grammar: FamilyGrammar,
  // filled is kept on the signature to match the generator's API even though
  // the scorer re-derives roles from the recipe shape — keeps callers from
  // having to reconstruct it if we add filled-role-specific checks later.
  _filled: Partial<Record<SlotRole, string>>,
  data: DataIndex,
): CandidateScore {
  const notes: string[] = [];

  const totalMl = recipe.ingredients.reduce((sum, ri) => sum + (ri.amountMl ?? 0), 0);
  const { min, max } = grammar.totalVolumeMl;
  let volume = 1;
  if (totalMl < min) {
    volume = Math.max(0, totalMl / min);
    notes.push(`total volume ${totalMl}ml under ${min}ml minimum`);
  } else if (totalMl > max) {
    volume = Math.max(0, 1 - (totalMl - max) / max);
    notes.push(`total volume ${totalMl}ml over ${max}ml maximum`);
  }

  let ratio = 1;
  const ratios = grammar.balance.ratios;
  if (ratios) {
    // Compute actual vs expected ratios relative to the first role that has a number.
    const roleMl: Record<string, number> = {};
    for (const ri of recipe.ingredients) {
      const role = roleFor(ri.ingredientId, grammar, data);
      if (!role || ri.amountMl == null) continue;
      roleMl[role] = (roleMl[role] ?? 0) + ri.amountMl;
    }

    const roles = Object.keys(ratios) as SlotRole[];
    const anchor = roles.find((r) => roleMl[r]);
    if (anchor && roleMl[anchor]) {
      const anchorExpected = ratios[anchor]!;
      const anchorActual = roleMl[anchor];
      const unitActual = anchorActual / anchorExpected;
      // Use max deviation across non-anchor roles: a single out-of-whack slot
      // (e.g. 4:1:1 sour) should punish the score, not be averaged away by the
      // anchor's trivial 0% deviation.
      let maxDeviation = 0;
      for (const role of roles) {
        if (role === anchor) continue;
        const expectedMl = unitActual * ratios[role]!;
        const actualMl = roleMl[role] ?? 0;
        if (expectedMl <= 0) continue;
        const deviation = Math.abs(actualMl - expectedMl) / expectedMl;
        if (deviation > maxDeviation) maxDeviation = deviation;
        if (deviation > 0.3) {
          notes.push(`${role} ratio off by ${Math.round(deviation * 100)}%`);
        }
      }
      ratio = Math.max(0, 1 - maxDeviation);
    }
  }

  // Palate-crowding check — don't double up on citrus or sweetener.
  const roleCount: Record<string, number> = {};
  for (const ri of recipe.ingredients) {
    const role = roleFor(ri.ingredientId, grammar, data);
    if (!role) continue;
    roleCount[role] = (roleCount[role] ?? 0) + 1;
  }
  let crowding = 0;
  if ((roleCount.citrus ?? 0) > 1) {
    crowding += 0.3;
    notes.push('two citrus sources');
  }
  if ((roleCount.sweetener ?? 0) > 1) {
    crowding += 0.3;
    notes.push('two sweeteners');
  }

  const novelty = 1; // generator dedups against seed corpus up-front
  const raw = 0.6 * ratio + 0.2 * volume + 0.2 * novelty - crowding;
  const total = Math.max(0, Math.min(1, raw));

  if (notes.length === 0) notes.push('balanced');

  return { total, ratio, volume, novelty, balanceNotes: notes };
}
