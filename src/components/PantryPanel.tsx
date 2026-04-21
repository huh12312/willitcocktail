import { useMemo, useState } from 'react';
import { useData } from '../data/source';
import { usePantry } from '../store/pantry';
import { PantryQuickAdd } from './PantryQuickAdd';
import type { Ingredient } from '../types';

type PantryGroup =
  | 'spirit'
  | 'liqueur'
  | 'wine'
  | 'mixer'
  | 'syrup'
  | 'bitter'
  | 'fruit'
  | 'vegetable'
  | 'herb_spice'
  | 'extra';

const GROUP_ORDER: PantryGroup[] = [
  'spirit',
  'liqueur',
  'wine',
  'mixer',
  'syrup',
  'bitter',
  'fruit',
  'vegetable',
  'herb_spice',
  'extra',
];

const GROUP_LABEL: Record<PantryGroup, string> = {
  spirit: 'Spirits',
  liqueur: 'Liqueurs',
  wine: 'Wines & Vermouths',
  mixer: 'Mixers',
  syrup: 'Syrups',
  bitter: 'Bitters',
  fruit: 'Fruit',
  vegetable: 'Vegetables',
  herb_spice: 'Herbs & Spices',
  extra: 'Extras',
};

const EXTRA_KEYWORDS = [
  'cream',
  'milk',
  'coffee',
  'espresso',
  'egg',
  'sugar',
  'water',
  'sauce',
  'tabasco',
];
const VEGETABLE_KEYWORDS = [
  'celery',
  'cucumber',
  'horseradish',
  'jalapeño',
  'jalapeno',
  'olive',
  'tomato',
];
const HERB_SPICE_KEYWORDS = [
  'basil',
  'cilantro',
  'mint',
  'rosemary',
  'sage',
  'thyme',
  'ginger',
  'cardamom',
  'cinnamon',
  'nutmeg',
  'anise',
  'pepper',
  'salt',
  'clove',
  'coriander',
];
const FRUIT_KEYWORDS = [
  'apple',
  'pear',
  'peach',
  'pineapple',
  'mango',
  'watermelon',
  'pomegranate',
  'passion',
  'strawberry',
  'raspberry',
  'blackberry',
  'cherry',
  'lemon',
  'lime',
  'orange',
  'grapefruit',
  'cranberry',
  'coconut',
  'maraschino',
  'berry',
  'twist',
];

function pantryGroup(i: Ingredient): PantryGroup {
  switch (i.category) {
    case 'spirit':
    case 'liqueur':
    case 'wine':
    case 'mixer':
    case 'syrup':
    case 'bitter':
      return i.category;
  }
  const name = i.name.toLowerCase();
  if (EXTRA_KEYWORDS.some((k) => name.includes(k))) return 'extra';
  if (VEGETABLE_KEYWORDS.some((k) => name.includes(k))) return 'vegetable';
  if (HERB_SPICE_KEYWORDS.some((k) => name.includes(k))) return 'herb_spice';
  if (FRUIT_KEYWORDS.some((k) => name.includes(k))) return 'fruit';
  return 'extra';
}

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
    const map = new Map<PantryGroup, Ingredient[]>();
    for (const g of GROUP_ORDER) map.set(g, []);
    for (const i of filtered) {
      const arr = map.get(pantryGroup(i));
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
        {GROUP_ORDER.map((g) => {
          const items = grouped.get(g) ?? [];
          if (items.length === 0) return null;
          return (
            <div key={g}>
              <h3 className="text-xs uppercase tracking-wider text-amber-400/60 mb-2">
                {GROUP_LABEL[g]}
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
