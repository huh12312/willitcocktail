import { useMemo, useState } from 'react';
import { useData } from '../data/source';
import { usePantry } from '../store/pantry';
import { useCustomRecipes } from '../store/custom-recipes';
import { generateCandidates, type GeneratedCandidate } from '../generation/generator';
import { getLlmProvider } from '../llm';
import type { Recipe } from '../types';

interface CreatePanelProps {
  onSelect: (id: string) => void;
}

export function CreatePanel({ onSelect }: CreatePanelProps) {
  const data = useData();
  const pantryIds = usePantry((s) => s.ingredients);
  const savedRecipes = useCustomRecipes((s) => s.recipes);
  const saveCustom = useCustomRecipes((s) => s.save);
  const removeCustom = useCustomRecipes((s) => s.remove);

  const [seed, setSeed] = useState(1);
  const [polishing, setPolishing] = useState<string | null>(null);
  const [polishOverrides, setPolishOverrides] = useState<Record<string, Recipe>>({});

  const baseCandidates = useMemo(
    () => generateCandidates({ pantryIds, data, seed, perFamily: 3 }),
    [pantryIds, data, seed],
  );

  const visible = useMemo(
    () =>
      baseCandidates.map((c) =>
        polishOverrides[c.recipe.id] ? { ...c, recipe: polishOverrides[c.recipe.id]! } : c,
      ),
    [baseCandidates, polishOverrides],
  );

  function regenerate() {
    setSeed((s) => s + 1);
    setPolishOverrides({});
  }

  async function polish(candidate: GeneratedCandidate) {
    setPolishing(candidate.recipe.id);
    try {
      const provider = await getLlmProvider();
      if (!provider.proposeRecipe) return;
      const polishResult = await provider.proposeRecipe(candidate.recipe, data);
      setPolishOverrides((prev) => ({
        ...prev,
        [candidate.recipe.id]: {
          ...candidate.recipe,
          name: polishResult.name,
          garnish: polishResult.garnish,
          instructions: polishResult.instructions,
        },
      }));
    } catch (err) {
      console.error('polish failed', err);
    } finally {
      setPolishing(null);
    }
  }

  function save(recipe: Recipe) {
    saveCustom(recipe);
  }

  const savedIds = new Set(savedRecipes.map((r) => r.id));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="text-sm text-amber-300/80">
          {pantryIds.length === 0
            ? 'Add ingredients to your pantry to invent new drinks.'
            : `${visible.length} candidate${visible.length === 1 ? '' : 's'} from your pantry`}
        </div>
        <button
          type="button"
          onClick={regenerate}
          disabled={pantryIds.length === 0}
          className="rounded-md bg-amber-500 text-amber-950 px-3 py-1.5 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-amber-400 transition"
        >
          Regenerate
        </button>
      </div>

      {pantryIds.length > 0 && visible.length === 0 && (
        <div className="rounded-lg border border-amber-700/40 p-6 text-center text-amber-300/70">
          No family grammar fits your current pantry. Try adding a base spirit, a citrus juice, and a sweetener.
        </div>
      )}

      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
        {visible.map((c) => (
          <CandidateCard
            key={c.recipe.id}
            candidate={c}
            onSelect={onSelect}
            onPolish={() => void polish(c)}
            onSave={() => save(c.recipe)}
            saved={savedIds.has(c.recipe.id)}
            polishing={polishing === c.recipe.id}
          />
        ))}
      </div>

      {savedRecipes.length > 0 && (
        <section className="mt-4">
          <h2 className="text-lg font-semibold text-emerald-400 mb-3">Saved inventions</h2>
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
            {savedRecipes.map((r) => (
              <div
                key={r.id}
                className="rounded-lg border border-emerald-700/40 bg-emerald-900/10 p-4"
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <button
                    type="button"
                    onClick={() => onSelect(r.id)}
                    className="font-semibold text-amber-100 hover:text-amber-300 text-left"
                  >
                    {r.name}
                  </button>
                  <button
                    type="button"
                    onClick={() => removeCustom(r.id)}
                    className="text-xs text-rose-300/70 hover:text-rose-300"
                    aria-label="Remove saved recipe"
                  >
                    ✕
                  </button>
                </div>
                <div className="text-xs text-amber-400/70 capitalize">
                  {r.family.replace('_', ' ')} · {r.method}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function CandidateCard({
  candidate,
  onSelect,
  onPolish,
  onSave,
  saved,
  polishing,
}: {
  candidate: GeneratedCandidate;
  onSelect: (id: string) => void;
  onPolish: () => void;
  onSave: () => void;
  saved: boolean;
  polishing: boolean;
}) {
  const data = useData();
  const { recipe, score } = candidate;
  return (
    <div className="rounded-lg border border-amber-700/40 bg-amber-900/20 p-4 flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          onClick={() => onSelect(recipe.id)}
          className="text-left flex-1"
        >
          <h3 className="font-semibold text-amber-100 hover:text-amber-300">{recipe.name}</h3>
          <div className="text-xs text-amber-400/70 capitalize">
            {recipe.family.replace('_', ' ')} · {recipe.method}
          </div>
        </button>
        <ScoreBadge score={score.total} />
      </div>
      <ul className="text-xs text-amber-200/80 space-y-0.5">
        {recipe.ingredients.map((ri) => (
          <li key={`${ri.ingredientId}-${ri.position}`}>
            <span className="font-mono text-amber-400/70">{ri.amountDisplay}</span>{' '}
            {data.ingredientById.get(ri.ingredientId)?.name ?? ri.ingredientId}
          </li>
        ))}
      </ul>
      <div className="text-[11px] text-amber-400/60 italic">
        {score.balanceNotes.slice(0, 2).join(' · ')}
      </div>
      <div className="flex gap-2 mt-1">
        <button
          type="button"
          onClick={onPolish}
          disabled={polishing}
          className="text-xs rounded-md border border-amber-700/40 text-amber-200 px-2.5 py-1 hover:bg-amber-700/20 transition disabled:opacity-50"
        >
          {polishing ? 'Polishing…' : 'Polish with LLM'}
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={saved}
          className="text-xs rounded-md border border-emerald-500/40 text-emerald-200 px-2.5 py-1 hover:bg-emerald-500/10 transition disabled:opacity-50"
        >
          {saved ? 'Saved' : 'Save'}
        </button>
      </div>
    </div>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const cls =
    score >= 0.75
      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
      : score >= 0.5
        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
        : 'bg-rose-500/20 text-rose-300 border-rose-500/40';
  return (
    <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${cls}`}>
      {pct}
    </span>
  );
}
