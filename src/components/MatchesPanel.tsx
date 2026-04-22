import { useMemo, useState } from 'react';
import { useData } from '../data/source';
import type { DataIndex } from '../data';
import { usePantry } from '../store/pantry';
import { matchRecipes, groupByTier } from '../matcher';
import type { Ingredient, MatchResult, Recipe } from '../types';

interface MatchesPanelProps {
  onSelect: (id: string) => void;
}

// Walks up the parent chain to find the top-level spirit category
// (e.g. bourbon → whiskey). Returns null if the ingredient isn't a spirit.
function rootSpirit(ingredient: Ingredient, data: DataIndex): Ingredient | null {
  if (ingredient.category !== 'spirit') return null;
  let cursor: Ingredient | undefined = ingredient;
  while (cursor?.parentId) {
    const parent = data.ingredientById.get(cursor.parentId);
    if (!parent || parent.category !== 'spirit') break;
    cursor = parent;
  }
  return cursor ?? null;
}

// The spirit with the largest amountMl, resolved to its root. Falls back to
// the first spirit-category ingredient when amounts aren't parsed.
function keyLiquor(recipe: Recipe, data: DataIndex): Ingredient | null {
  let best: { root: Ingredient; ml: number } | null = null;
  for (const ri of recipe.ingredients) {
    const ing = data.ingredientById.get(ri.ingredientId);
    if (!ing) continue;
    const root = rootSpirit(ing, data);
    if (!root) continue;
    const ml = ri.amountMl ?? 0;
    if (!best || ml > best.ml) best = { root, ml };
  }
  return best?.root ?? null;
}

export function MatchesPanel({ onSelect }: MatchesPanelProps) {
  const data = useData();
  const { ingredients, strictMode, classicsOnly, minStrength, toggleStrict, toggleClassicsOnly } =
    usePantry();
  const [liquorFilter, setLiquorFilter] = useState<string | null>(null);

  const results = useMemo(
    () =>
      matchRecipes(
        ingredients,
        {
          strict: strictMode,
          minSubstituteStrength: minStrength,
          classicsOnly,
        },
        data,
      ),
    [data, ingredients, strictMode, classicsOnly, minStrength],
  );

  // (keyLiquor id, count) across the current result set, sorted desc.
  const liquorCounts = useMemo(() => {
    const counts = new Map<string, { ingredient: Ingredient; count: number }>();
    for (const r of results) {
      const liq = keyLiquor(r.recipe, data);
      if (!liq) continue;
      const entry = counts.get(liq.id);
      if (entry) entry.count += 1;
      else counts.set(liq.id, { ingredient: liq, count: 1 });
    }
    return Array.from(counts.values()).sort((a, b) => b.count - a.count);
  }, [results, data]);

  const filteredResults = useMemo(() => {
    if (!liquorFilter) return results;
    return results.filter((r) => keyLiquor(r.recipe, data)?.id === liquorFilter);
  }, [results, liquorFilter, data]);

  const groups = useMemo(() => groupByTier(filteredResults), [filteredResults]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="text-sm text-amber-300/80">
          {filteredResults.length} match{filteredResults.length === 1 ? '' : 'es'}
          {liquorFilter && results.length !== filteredResults.length && ` of ${results.length}`}
          {strictMode && ' (strict)'}
          {classicsOnly && ' (classics)'}
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={classicsOnly}
              onChange={toggleClassicsOnly}
              className="accent-amber-500"
            />
            Classics only
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={strictMode}
              onChange={toggleStrict}
              className="accent-amber-500"
            />
            Strict mode
          </label>
        </div>
      </div>

      {liquorCounts.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setLiquorFilter(null)}
            className={[
              'px-3 py-1 rounded-full text-xs border transition',
              liquorFilter === null
                ? 'bg-amber-500 text-amber-950 border-amber-400'
                : 'bg-amber-900/20 border-amber-700/40 text-amber-200 hover:border-amber-500',
            ].join(' ')}
          >
            All · {results.length}
          </button>
          {liquorCounts.map(({ ingredient, count }) => (
            <button
              key={ingredient.id}
              type="button"
              onClick={() =>
                setLiquorFilter((current) => (current === ingredient.id ? null : ingredient.id))
              }
              className={[
                'px-3 py-1 rounded-full text-xs border transition',
                liquorFilter === ingredient.id
                  ? 'bg-amber-500 text-amber-950 border-amber-400'
                  : 'bg-amber-900/20 border-amber-700/40 text-amber-200 hover:border-amber-500',
              ].join(' ')}
            >
              {ingredient.name} · {count}
            </button>
          ))}
        </div>
      )}

      {ingredients.length === 0 && (
        <div className="rounded-lg border border-amber-700/40 p-6 text-center text-amber-300/70">
          Add ingredients to your pantry to see cocktails you can make.
        </div>
      )}

      <TierSection
        title="Make it now"
        subtitle="Everything in your pantry"
        results={groups.exact}
        onSelect={onSelect}
        accent="text-emerald-400"
      />
      {!strictMode && (
        <TierSection
          title="With one substitution"
          subtitle="Swap one ingredient for something you have"
          results={groups.near}
          onSelect={onSelect}
          accent="text-amber-400"
        />
      )}
      {!strictMode && (
        <TierSection
          title="Almost there"
          subtitle="Just one more ingredient to pick up"
          results={groups.almost}
          onSelect={onSelect}
          accent="text-rose-400"
        />
      )}
    </div>
  );
}

interface TierSectionProps {
  title: string;
  subtitle: string;
  results: MatchResult[];
  accent: string;
  onSelect: (id: string) => void;
}

function TierSection({ title, subtitle, results, accent, onSelect }: TierSectionProps) {
  if (results.length === 0) return null;
  return (
    <section>
      <div className="flex items-baseline gap-3 mb-3">
        <h2 className={`text-lg font-semibold ${accent}`}>{title}</h2>
        <span className="text-xs text-amber-400/60">{subtitle}</span>
        <span className="ml-auto text-xs text-amber-300/60">{results.length}</span>
      </div>
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {results.map((r) => (
          <MatchCard key={r.recipe.id} result={r} onSelect={onSelect} />
        ))}
      </div>
    </section>
  );
}

function MatchCard({ result, onSelect }: { result: MatchResult; onSelect: (id: string) => void }) {
  const data = useData();
  const { recipe, tier, substitutions, missing } = result;
  const liquor = keyLiquor(recipe, data);
  return (
    <button
      type="button"
      onClick={() => onSelect(recipe.id)}
      className="text-left rounded-lg border border-amber-700/40 bg-amber-900/20 p-4 hover:border-amber-500 hover:bg-amber-900/40 transition"
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <h3 className="font-semibold text-amber-100">{recipe.name}</h3>
        <div className="flex items-center gap-1 shrink-0">
          {liquor && (
            <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-300 border border-sky-500/40">
              {liquor.name}
            </span>
          )}
          {recipe.ibaOfficial && (
            <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
              IBA
            </span>
          )}
        </div>
      </div>
      <div className="text-xs text-amber-400/70 mb-2 capitalize">
        {recipe.family.replace('_', ' ')} · {recipe.method}
      </div>

      {tier === 'near' && substitutions.length > 0 && (
        <div className="text-xs text-amber-300/90 mt-2 space-y-1">
          {substitutions.map((s, idx) => (
            <div key={idx}>
              <span className="opacity-60">Use</span>{' '}
              <span className="font-medium">{data.ingredientById.get(s.useId)?.name}</span>{' '}
              <span className="opacity-60">for</span>{' '}
              <span className="font-medium">{data.ingredientById.get(s.originalId)?.name}</span>
            </div>
          ))}
        </div>
      )}

      {tier === 'almost' && missing.length > 0 && (
        <div className="text-xs text-rose-300/90 mt-2">
          Need: {missing.map((m) => data.ingredientById.get(m)?.name).join(', ')}
        </div>
      )}
    </button>
  );
}
