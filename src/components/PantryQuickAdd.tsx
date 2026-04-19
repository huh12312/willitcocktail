import { useState } from 'react';
import { useData } from '../data/source';
import { usePantry } from '../store/pantry';
import { getLlmProvider } from '../llm';
import type { ParsedPantry } from '../llm';

export function PantryQuickAdd() {
  const data = useData();
  const add = usePantry((s) => s.add);
  const [text, setText] = useState('');
  const [parsed, setParsed] = useState<ParsedPantry | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmedIds, setConfirmedIds] = useState<Set<string>>(new Set());

  async function onParse() {
    if (!text.trim()) return;
    setLoading(true);
    setConfirmedIds(new Set());
    try {
      const provider = await getLlmProvider();
      const res = await provider.parseIngredients(text, data);
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

  function reset() {
    setText('');
    setParsed(null);
    setConfirmedIds(new Set());
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
        className="mt-2 w-full rounded-md bg-amber-950/40 border border-amber-700/40 px-3 py-2 text-sm text-amber-100 placeholder:text-amber-500/50 focus:outline-none focus:border-amber-500"
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
                  return (
                    <button
                      key={r.ingredientId}
                      type="button"
                      onClick={() => addOne(r.ingredientId)}
                      disabled={added}
                      className={[
                        'px-3 py-1.5 rounded-full text-sm border transition',
                        added
                          ? 'bg-emerald-500/20 text-emerald-200 border-emerald-500/40 cursor-default'
                          : 'bg-amber-900/20 border-amber-700/40 text-amber-100 hover:border-amber-500',
                      ].join(' ')}
                    >
                      {added ? '✓ ' : '+ '}
                      {r.ingredientName}
                      {r.confidence < 0.9 && (
                        <span className="ml-1 text-[10px] opacity-60">
                          ~{Math.round(r.confidence * 100)}%
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {parsed.unresolved.length > 0 && (
            <div>
              <div className="text-xs uppercase tracking-wider text-rose-300/80 mb-2">
                Didn't recognize
              </div>
              <div className="flex flex-wrap gap-2">
                {parsed.unresolved.map((u, i) => (
                  <span
                    key={i}
                    className="text-xs rounded-full border border-rose-500/30 px-2.5 py-1 text-rose-200/80"
                  >
                    {u}
                  </span>
                ))}
              </div>
            </div>
          )}
          {parsed.resolved.length === 0 && parsed.unresolved.length === 0 && (
            <div className="text-xs text-amber-400/70">No ingredients recognized.</div>
          )}
        </div>
      )}
    </div>
  );
}
