import { useMemo, useState } from 'react';
import { useData } from '../data/source';
import { keyLiquor, liquorCounts } from '../data/recipe-utils';

interface RecipesPanelProps {
  onSelect: (id: string) => void;
}

const MAX_DISPLAY = 250;

export function RecipesPanel({ onSelect }: RecipesPanelProps) {
  const data = useData();
  const [search, setSearch] = useState('');
  const [liquorFilter, setLiquorFilter] = useState<string | null>(null);

  const allLiquorCounts = useMemo(
    () => liquorCounts(data.recipes, data),
    [data],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.recipes
      .filter((r) => {
        if (liquorFilter && keyLiquor(r, data)?.id !== liquorFilter) return false;
        if (q && !r.name.toLowerCase().includes(q)) return false;
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [data, search, liquorFilter]);

  const displayed = filtered.slice(0, MAX_DISPLAY);

  return (
    <div className="flex flex-col gap-5">
      {/* Search */}
      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search recipes…"
        className="w-full rounded-md bg-amber-950/40 border border-amber-700/40 px-3 py-2 text-amber-100 placeholder:text-amber-500/50 focus:outline-none focus:border-amber-500"
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
          : filtered.length > MAX_DISPLAY
          ? `Showing ${MAX_DISPLAY} of ${filtered.length} — refine your search to narrow results`
          : `${filtered.length} recipe${filtered.length === 1 ? '' : 's'}`}
      </div>

      {/* Recipe grid */}
      <div className="grid gap-2 grid-cols-1 sm:grid-cols-2">
        {displayed.map((recipe) => {
          const liquor = keyLiquor(recipe, data);
          return (
            <button
              key={recipe.id}
              type="button"
              onClick={() => onSelect(recipe.id)}
              className="text-left rounded-lg border border-amber-700/40 bg-amber-900/20 px-4 py-3 hover:border-amber-500 hover:bg-amber-900/40 transition"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-medium text-amber-100 text-sm leading-snug">{recipe.name}</span>
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
              <div className="text-[11px] text-amber-400/60 mt-0.5 capitalize">
                {recipe.family.replace('_', ' ')} · {recipe.method}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
