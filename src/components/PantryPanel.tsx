import { useMemo, useState } from 'react';
import { useData } from '../data/source';
import { usePantry } from '../store/pantry';
import { PantryQuickAdd } from './PantryQuickAdd';
import type { Ingredient, IngredientCategory } from '../types';

const CATEGORY_ORDER: IngredientCategory[] = [
  'spirit',
  'liqueur',
  'wine',
  'juice',
  'syrup',
  'bitter',
  'mixer',
  'other',
  'garnish',
];

const CATEGORY_LABEL: Record<IngredientCategory, string> = {
  spirit: 'Spirits',
  liqueur: 'Liqueurs',
  wine: 'Wines & Vermouths',
  juice: 'Juices',
  syrup: 'Syrups',
  bitter: 'Bitters',
  mixer: 'Mixers',
  other: 'Pantry Extras',
  garnish: 'Garnishes',
};

export function PantryPanel() {
  const data = useData();
  const [query, setQuery] = useState('');
  const [showAll, setShowAll] = useState(false);
  const { ingredients, add, remove, clear } = usePantry();

  const pantrySet = useMemo(() => new Set(ingredients), [ingredients]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.ingredients.filter((i) => {
      if (showAll || pantrySet.has(i.id) || q) {
        if (!q) return true;
        return i.name.toLowerCase().includes(q) || i.id.toLowerCase().includes(q);
      }
      return false;
    });
  }, [data, query, showAll, pantrySet]);

  const grouped = useMemo(() => {
    const map = new Map<IngredientCategory, Ingredient[]>();
    for (const cat of CATEGORY_ORDER) map.set(cat, []);
    for (const i of filtered) {
      const arr = map.get(i.category);
      if (arr) arr.push(i);
    }
    return map;
  }, [filtered]);

  return (
    <div className="flex flex-col gap-4">
      <PantryQuickAdd />

      <div className="flex items-center gap-2">
        <input
          className="flex-1 rounded-md bg-amber-900/40 border border-amber-700/40 px-3 py-2 placeholder-amber-400/50 focus:outline-none focus:ring-1 focus:ring-amber-500"
          placeholder="Search ingredients…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button
          type="button"
          onClick={() => setShowAll((s) => !s)}
          className="px-3 py-2 rounded-md border border-amber-700/40 text-sm hover:bg-amber-900/40"
        >
          {showAll ? 'Show my pantry' : 'Browse all'}
        </button>
      </div>

      <div className="flex items-center justify-between text-sm text-amber-300/80">
        <span>
          {ingredients.length} ingredient{ingredients.length === 1 ? '' : 's'} in pantry
        </span>
        {ingredients.length > 0 && (
          <button
            type="button"
            onClick={() => {
              if (confirm('Clear your pantry?')) clear();
            }}
            className="text-amber-400/70 hover:text-amber-200 underline"
          >
            Clear
          </button>
        )}
      </div>

      <div className="flex flex-col gap-5">
        {CATEGORY_ORDER.map((cat) => {
          const items = grouped.get(cat) ?? [];
          if (items.length === 0) return null;
          return (
            <div key={cat}>
              <h3 className="text-xs uppercase tracking-wider text-amber-400/60 mb-2">
                {CATEGORY_LABEL[cat]}
              </h3>
              <div className="flex flex-wrap gap-2">
                {items.map((i) => {
                  const inPantry = pantrySet.has(i.id);
                  return (
                    <button
                      key={i.id}
                      type="button"
                      onClick={() => (inPantry ? remove(i.id) : add(i.id))}
                      className={[
                        'px-3 py-1.5 rounded-full text-sm border transition',
                        inPantry
                          ? 'bg-amber-500 text-amber-950 border-amber-400'
                          : 'bg-amber-900/20 border-amber-700/40 text-amber-100 hover:border-amber-500',
                      ].join(' ')}
                    >
                      {inPantry ? '✓ ' : '+ '}
                      {i.name}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-amber-400/60 text-sm py-8 text-center">
            {ingredients.length === 0
              ? 'Your pantry is empty. Tap "Browse all" or search to add ingredients.'
              : 'No ingredients match your search.'}
          </div>
        )}
      </div>
    </div>
  );
}
