import { useMemo, useState } from 'react';
import { useData } from '../data/source';
import { useCustomRecipes } from '../store/custom-recipes';
import { keyLiquor, liquorCounts } from '../data/recipe-utils';

interface RecipesPanelProps {
  onSelect: (id: string) => void;
}

const PAGE_SIZE = 100;

export function RecipesPanel({ onSelect }: RecipesPanelProps) {
  const data = useData();
  const removeCustom = useCustomRecipes((s) => s.remove);
  const [search, setSearch] = useState('');
  const [liquorFilter, setLiquorFilter] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const allLiquorCounts = useMemo(
    () => liquorCounts(data.recipes, data),
    [data],
  );

  const filtered = useMemo(() => {
    // Reset pagination when filters change.
    setVisibleCount(PAGE_SIZE);
    const q = search.trim().toLowerCase();
    return data.recipes
      .filter((r) => {
        if (liquorFilter && keyLiquor(r, data)?.id !== liquorFilter) return false;
        if (q) {
          const nameMatch = r.name.toLowerCase().includes(q);
          const ingredientMatch = r.ingredients.some((ri) =>
            (data.ingredientById.get(ri.ingredientId)?.name ?? '').toLowerCase().includes(q),
          );
          if (!nameMatch && !ingredientMatch) return false;
        }
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [data, search, liquorFilter]);

  const displayed = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  return (
    <div className="flex flex-col gap-5">
      {/* Search */}
      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by name or ingredient…"
        className="w-full rounded-md bg-amber-950/40 border border-amber-700/40 px-3 py-2 text-amber-100 placeholder:text-amber-500/50 focus:outline-hidden focus:border-amber-500"
      />

      {/* Liquor filter chips */}
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
          All · {data.recipes.length}
        </button>
        {allLiquorCounts.map(({ ingredient, count }) => (
          <button
            key={ingredient.id}
            type="button"
            onClick={() =>
              setLiquorFilter((cur) => (cur === ingredient.id ? null : ingredient.id))
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

      {/* Result count */}
      <div className="text-xs text-amber-400/60">
        {filtered.length === 0
          ? 'No recipes match.'
          : `Showing ${displayed.length} of ${filtered.length} recipe${filtered.length === 1 ? '' : 's'}`}
      </div>

      {/* Recipe grid */}
      <div className="grid gap-2 grid-cols-1 sm:grid-cols-2">
        {displayed.map((recipe) => {
          const liquor = keyLiquor(recipe, data);
          const isGenerated = recipe.source === 'generated';
          return (
            <div key={recipe.id} className="relative group">
              <button
                type="button"
                onClick={() => onSelect(recipe.id)}
                className="w-full text-left rounded-lg border border-amber-700/40 bg-amber-900/20 px-4 py-3 hover:border-amber-500 hover:bg-amber-900/40 transition"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium text-amber-100 text-sm leading-snug">{recipe.name}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    {isGenerated && (
                      <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-300 border border-violet-500/40">
                        Created
                      </span>
                    )}
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
                <div className="text-[11px] text-amber-400/60 mt-0.5 capitalize">
                  {recipe.family.replace('_', ' ')} · {recipe.method}
                </div>
              </button>
              {isGenerated && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); removeCustom(recipe.id); }}
                  aria-label={`Delete ${recipe.name}`}
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-rose-400/70 hover:text-rose-300 text-xs px-1.5 py-0.5 transition-opacity"
                >
                  ✕
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Load more */}
      {hasMore && (
        <button
          type="button"
          onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
          className="w-full rounded-lg border border-amber-700/40 py-3 text-sm text-amber-300/80 hover:border-amber-500 hover:text-amber-200 transition"
        >
          Load {Math.min(PAGE_SIZE, filtered.length - visibleCount)} more
          <span className="text-amber-400/50 ml-2 text-xs">({filtered.length - visibleCount} remaining)</span>
        </button>
      )}
    </div>
  );
}
