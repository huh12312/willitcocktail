import { useEffect, useMemo } from 'react';
import { useData } from '../data/source';
import { usePantry } from '../store/pantry';
import { pantryCovers } from '../data/pantry-covers';
import { describeRecipe } from '../data/recipe_descriptions';

interface RecipeModalProps {
  recipeId: string | null;
  onClose: () => void;
}

export function RecipeModal({ recipeId, onClose }: RecipeModalProps) {
  const data = useData();
  const pantryIds = usePantry((s) => s.ingredients);
  const minStrength = usePantry((s) => s.minStrength);
  const pantrySet = useMemo(() => new Set(pantryIds), [pantryIds]);

  useEffect(() => {
    if (!recipeId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [recipeId, onClose]);

  if (!recipeId) return null;
  const recipe = data.recipes.find((r) => r.id === recipeId);
  if (!recipe) return null;

  function bestSubstitute(id: string): { useId: string; strength: number; notes: string | null } | null {
    const subs = data.substitutesOf.get(id) ?? [];
    let best: { useId: string; strength: number; notes: string | null } | null = null;
    for (const s of subs) {
      if (s.strength < minStrength) continue;
      if (!pantryCovers(s.substituteId, pantrySet, data)) continue;
      if (!best || s.strength > best.strength) {
        best = { useId: s.substituteId, strength: s.strength, notes: s.notes ?? null };
      }
    }
    return best;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative max-w-xl w-full max-h-[90vh] overflow-y-auto rounded-xl bg-amber-950 border border-amber-700/50 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 w-8 h-8 rounded-full bg-amber-900/60 hover:bg-amber-800 text-amber-100 flex items-center justify-center"
        >
          ✕
        </button>

        <div className="p-6">
          <div className="flex items-center gap-2 mb-2">
            <h2 className="text-2xl font-bold text-amber-100">{recipe.name}</h2>
            {recipe.ibaOfficial && (
              <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                IBA Official
              </span>
            )}
          </div>
          <div className="text-sm text-amber-400/70 mb-6 capitalize">
            {recipe.family.replace('_', ' ')} · {recipe.method} · {recipe.glass}
          </div>

          <h3 className="text-xs uppercase tracking-wider text-amber-400/60 mb-2">
            Ingredients
          </h3>
          <ul className="mb-6 divide-y divide-amber-800/40">
            {recipe.ingredients.map((ri) => {
              const ing = data.ingredientById.get(ri.ingredientId);
              const have = pantryCovers(ri.ingredientId, pantrySet, data);
              const sub = !have && !ri.optional ? bestSubstitute(ri.ingredientId) : null;
              const subName = sub ? data.ingredientById.get(sub.useId)?.name ?? sub.useId : null;
              return (
                <li
                  key={`${ri.ingredientId}-${ri.position}`}
                  className="flex flex-col gap-1 py-2"
                >
                  <div className="flex items-baseline gap-3">
                    <span
                      className={
                        have
                          ? 'text-emerald-400 text-sm'
                          : sub
                            ? 'text-amber-400 text-sm'
                            : 'text-rose-300/70 text-sm'
                      }
                      aria-label={have ? 'in pantry' : sub ? 'substitute available' : 'missing'}
                    >
                      {have ? '✓' : sub ? '↔' : '○'}
                    </span>
                    <span className="flex-1">
                      {ing?.name ?? ri.ingredientId}
                      {ri.optional && (
                        <span className="text-xs text-amber-400/60 ml-1">(optional)</span>
                      )}
                      {ri.notes && (
                        <span className="text-xs text-amber-400/60 ml-1">({ri.notes})</span>
                      )}
                    </span>
                    <span className="text-sm text-amber-300/80">{ri.amountDisplay}</span>
                  </div>
                  {sub && subName && (
                    <div className="ml-7 text-xs text-amber-300/90">
                      Sub: use <span className="font-medium">{subName}</span>
                      <span className="opacity-60"> ({Math.round(sub.strength * 100)}% match)</span>
                      {sub.notes && <span className="opacity-60"> — {sub.notes}</span>}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          <h3 className="text-xs uppercase tracking-wider text-amber-400/60 mb-2">Method</h3>
          <p className="text-sm text-amber-100/90 leading-relaxed mb-4">
            {recipe.instructions}
          </p>

          {recipe.garnish && (
            <>
              <h3 className="text-xs uppercase tracking-wider text-amber-400/60 mb-2">
                Garnish
              </h3>
              <p className="text-sm text-amber-100/90">{recipe.garnish}</p>
            </>
          )}

          <p className="mt-6 pt-4 border-t border-amber-800/40 text-sm text-amber-200/80 italic leading-relaxed">
            {describeRecipe(recipe, data)}
          </p>
        </div>
      </div>
    </div>
  );
}
