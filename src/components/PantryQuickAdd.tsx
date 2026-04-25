import { useState } from 'react';
import { useData } from '../data/source';
import { usePantry } from '../store/pantry';
import { useCustomIngredients, toCustomIngredientId, type CustomIngredient } from '../store/custom-ingredients';
import { HeuristicProvider } from '../llm';
import type { ParsedPantry } from '../llm';
import type { IngredientCategory } from '../types';

const CATEGORY_OPTIONS: { value: IngredientCategory; label: string }[] = [
  { value: 'spirit',  label: 'Spirit'  },
  { value: 'liqueur', label: 'Liqueur' },
  { value: 'wine',    label: 'Wine'    },
  { value: 'mixer',   label: 'Mixer'   },
  { value: 'juice',   label: 'Juice'   },
  { value: 'syrup',   label: 'Syrup'   },
  { value: 'bitter',  label: 'Bitter'  },
  { value: 'other',   label: 'Other'   },
];

export function PantryQuickAdd() {
  const data = useData();
  const add = usePantry((s) => s.add);
  const has = usePantry((s) => s.has);
  const { add: addCustom } = useCustomIngredients();
  const [text, setText] = useState('');
  const [parsed, setParsed] = useState<ParsedPantry | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmedIds, setConfirmedIds] = useState<Set<string>>(new Set());
  // The unresolved phrase currently being set up as a custom ingredient.
  const [pendingCustom, setPendingCustom] = useState<{ phrase: string; category: IngredientCategory } | null>(null);

  async function onParse() {
    if (!text.trim()) return;
    setLoading(true);
    setConfirmedIds(new Set());
    setPendingCustom(null);
    try {
      const res = await new HeuristicProvider().parseIngredients(text, data);
      setParsed(res);
    } catch (err) {
      console.error('parse failed', err);
      setParsed({ resolved: [], unresolved: [text] });
    } finally {
      setLoading(false);
    }
  }

  function addAll() {
    if (!parsed) return;
    const newlyAdded = new Set(confirmedIds);
    for (const r of parsed.resolved) {
      add(r.ingredientId);
      newlyAdded.add(r.ingredientId);
    }
    setConfirmedIds(newlyAdded);
  }

  function addOne(id: string) {
    add(id);
    setConfirmedIds((s) => new Set(s).add(id));
  }

  function confirmCustom() {
    if (!pendingCustom) return;
    const id = toCustomIngredientId(pendingCustom.phrase);
    const ing: CustomIngredient = { id, name: pendingCustom.phrase, category: pendingCustom.category };
    addCustom(ing);
    add(id);
    // Mark as resolved in the UI so it shows confirmed.
    setConfirmedIds((s) => new Set(s).add(id));
    // Remove from the unresolved list.
    setParsed((prev) =>
      prev ? { ...prev, unresolved: prev.unresolved.filter((u) => u !== pendingCustom.phrase) } : prev,
    );
    setPendingCustom(null);
  }

  function reset() {
    setText('');
    setParsed(null);
    setConfirmedIds(new Set());
    setPendingCustom(null);
  }

  return (
    <div className="rounded-lg border border-amber-700/40 bg-amber-900/10 p-4">
      <label className="text-sm text-amber-300/80" htmlFor="quick-add">
        Paste what you have on hand
      </label>
      <textarea
        id="quick-add"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="e.g. gin, sweet vermouth, some campari, lime juice"
        rows={2}
        className="mt-2 w-full rounded-md bg-amber-950/40 border border-amber-700/40 px-3 py-2 text-sm text-amber-100 placeholder:text-amber-500/50 focus:outline-hidden focus:border-amber-500"
      />
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={() => void onParse()}
          disabled={loading || !text.trim()}
          className="rounded-md bg-amber-500 text-amber-950 px-3 py-1.5 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-amber-400 transition"
        >
          {loading ? 'Parsing…' : 'Parse'}
        </button>
        {parsed && (
          <button
            type="button"
            onClick={reset}
            className="rounded-md border border-amber-700/40 px-3 py-1.5 text-sm text-amber-300/80 hover:border-amber-500 transition"
          >
            Reset
          </button>
        )}
      </div>

      {parsed && (
        <div className="mt-4 flex flex-col gap-3">
          {parsed.resolved.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs uppercase tracking-wider text-amber-400/70">
                  Found {parsed.resolved.length}
                </div>
                <button
                  type="button"
                  onClick={addAll}
                  className="text-xs rounded-md border border-amber-500/40 text-amber-300 px-2 py-1 hover:bg-amber-500/10 transition"
                >
                  Add all
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {parsed.resolved.map((r) => {
                  const added = confirmedIds.has(r.ingredientId);
                  const inPantry = has(r.ingredientId);
                  const lowConf = r.confidence < 0.85;
                  // Offer "add as custom" when the match is fuzzy or the
                  // resolved ingredient is already in the pantry (meaning the
                  // user likely meant a distinct product, e.g. "walnut bitters"
                  // matching angostura at 75% when angostura is already stocked).
                  const offerCustom = !added && (lowConf || inPantry);
                  return (
                    <div key={r.ingredientId} className="flex flex-col items-start gap-0.5">
                      <button
                        type="button"
                        onClick={() => { if (!inPantry) addOne(r.ingredientId); }}
                        disabled={added || inPantry}
                        className={[
                          'px-3 py-1.5 rounded-full text-sm border transition',
                          added || inPantry
                            ? 'bg-emerald-500/20 text-emerald-200 border-emerald-500/40 cursor-default'
                            : 'bg-amber-900/20 border-amber-700/40 text-amber-100 hover:border-amber-500',
                        ].join(' ')}
                      >
                        {added || inPantry ? '✓ ' : '+ '}
                        {r.ingredientName}
                        {r.confidence < 0.9 && (
                          <span className="ml-1 text-[10px] opacity-60">
                            ~{Math.round(r.confidence * 100)}%
                          </span>
                        )}
                      </button>
                      {offerCustom && (
                        <button
                          type="button"
                          onClick={() =>
                            setPendingCustom(
                              pendingCustom?.phrase === r.input ? null : { phrase: r.input, category: 'bitter' },
                            )
                          }
                          className={[
                            'text-[10px] rounded-full border px-2 py-0.5 transition',
                            pendingCustom?.phrase === r.input
                              ? 'border-amber-500 bg-amber-900/40 text-amber-200'
                              : 'border-amber-600/40 text-amber-400 hover:border-amber-400 hover:text-amber-200',
                          ].join(' ')}
                        >
                          + custom: {r.input}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {parsed.unresolved.length > 0 && (
            <div>
              <div className="text-xs uppercase tracking-wider text-rose-300/80 mb-2">
                Didn't recognize — tap to add as custom
              </div>
              <div className="flex flex-wrap gap-2">
                {parsed.unresolved.map((u, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() =>
                      setPendingCustom(
                        pendingCustom?.phrase === u ? null : { phrase: u, category: 'spirit' },
                      )
                    }
                    className={[
                      'text-xs rounded-full border px-2.5 py-1 transition',
                      pendingCustom?.phrase === u
                        ? 'border-amber-500 bg-amber-900/40 text-amber-200'
                        : 'border-rose-500/30 text-rose-200/80 hover:border-amber-500 hover:text-amber-200',
                    ].join(' ')}
                  >
                    {u}
                  </button>
                ))}
              </div>

            </div>
          )}

          {parsed.resolved.length === 0 && parsed.unresolved.length === 0 && (
            <div className="text-xs text-amber-400/70">No ingredients recognized.</div>
          )}

          {/* Custom ingredient form — shown when triggered from either resolved or unresolved items */}
          {pendingCustom && (
            <div className="rounded-md border border-amber-600/40 bg-amber-900/20 p-3 flex flex-col gap-2">
              <div className="text-xs text-amber-300/80">
                Add <span className="font-semibold text-amber-100">{pendingCustom.phrase}</span> as a custom ingredient:
              </div>
              <div className="flex gap-2 items-center flex-wrap">
                <select
                  value={pendingCustom.category}
                  onChange={(e) =>
                    setPendingCustom({ ...pendingCustom, category: e.target.value as IngredientCategory })
                  }
                  className="rounded-md bg-amber-950/40 border border-amber-700/40 px-2 py-1.5 text-sm text-amber-100 focus:outline-hidden focus:border-amber-500"
                >
                  {CATEGORY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={confirmCustom}
                  className="rounded-md bg-amber-500 text-amber-950 px-3 py-1.5 text-sm font-medium hover:bg-amber-400 transition"
                >
                  Add to pantry
                </button>
                <button
                  type="button"
                  onClick={() => setPendingCustom(null)}
                  className="text-xs text-amber-400/60 hover:text-amber-300 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
