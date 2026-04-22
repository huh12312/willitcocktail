import { useEffect, useMemo, useRef, useState } from 'react';
import { useData } from '../data/source';
import { usePantry } from '../store/pantry';
import { activeProviderId, getLlmProvider, HeuristicProvider } from '../llm';
import type { IntentSearchResult, LlmRecipeDetails } from '../llm';

interface AskPanelProps {
  onSelect: (id: string) => void;
}

const EXAMPLES = [
  'Something refreshing and citrusy',
  'A bitter, spirit-forward stirred drink',
  'Herbal gin cocktail',
  'Tropical rum drink',
];

interface ToolEvent {
  name: string;
  args: string;
  at: number;
}

export function AskPanel({ onSelect }: AskPanelProps) {
  const data = useData();
  const pantryIds = usePantry((s) => s.ingredients);
  const addToPantry = usePantry((s) => s.add);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState('');
  const [toolEvents, setToolEvents] = useState<ToolEvent[]>([]);
  const [result, setResult] = useState<IntentSearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mentioned, setMentioned] = useState<{ id: string; name: string }[]>([]);
  const [selectedLlmMatch, setSelectedLlmMatch] = useState<IntentSearchResult['matches'][number] | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const heuristic = useMemo(() => new HeuristicProvider(), []);

  async function run(q: string) {
    const trimmed = q.trim();
    if (!trimmed) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setLoading(true);
    setError(null);
    setStreaming('');
    setToolEvents([]);
    setResult(null);
    setMentioned([]);

    try {
      // Extract any ingredients the user named in the query so we can
      // expand the pantry temporarily and offer to add them permanently.
      const parsed = await heuristic.parseIngredients(trimmed, data);
      const pantrySet = new Set(pantryIds);
      const newMentions = parsed.resolved
        .filter((r) => !pantrySet.has(r.ingredientId))
        .map((r) => ({ id: r.ingredientId, name: r.ingredientName }));
      setMentioned(newMentions);

      const expandedPantry = Array.from(
        new Set([...pantryIds, ...newMentions.map((m) => m.id)]),
      );

      const provider = await getLlmProvider({
        onToken: (tok) => setStreaming((s) => s + tok),
        onToolCall: (name, args) =>
          setToolEvents((prev) => [...prev, { name, args, at: Date.now() }]),
        signal: ctrl.signal,
      });
      const res = await provider.searchIntent(trimmed, expandedPantry, data);
      if (!ctrl.signal.aborted) setResult(res);
    } catch (err) {
      if (ctrl.signal.aborted) return;
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (abortRef.current === ctrl) abortRef.current = null;
      setLoading(false);
    }
  }

  function cancel() {
    abortRef.current?.abort();
    setLoading(false);
  }

  const provider = activeProviderId();

  return (
    <div className="flex flex-col gap-5">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run(query);
        }}
        className="flex flex-col gap-2"
      >
        <label className="text-sm text-amber-300/80 flex items-center justify-between" htmlFor="ask-input">
          <span>What are you in the mood for?</span>
          <span className="text-[10px] uppercase tracking-wider text-amber-400/60">
            via {provider}
          </span>
        </label>
        <div className="flex gap-2">
          <input
            id="ask-input"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. something bitter and stirred"
            className="flex-1 rounded-md bg-amber-950/40 border border-amber-700/40 px-3 py-2 text-amber-100 placeholder:text-amber-500/50 focus:outline-none focus:border-amber-500"
          />
          {loading ? (
            <button
              type="button"
              onClick={cancel}
              className="rounded-md border border-rose-500/40 text-rose-200 px-4 py-2 text-sm font-medium hover:bg-rose-500/10 transition"
            >
              Stop
            </button>
          ) : (
            <button
              type="submit"
              disabled={!query.trim()}
              className="rounded-md bg-amber-500 text-amber-950 px-4 py-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-amber-400 transition"
            >
              Ask
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2 mt-1">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => {
                setQuery(ex);
                void run(ex);
              }}
              className="text-xs rounded-full border border-amber-700/40 px-3 py-1 text-amber-300/80 hover:border-amber-500 hover:text-amber-200 transition"
            >
              {ex}
            </button>
          ))}
        </div>
      </form>

      {mentioned.length > 0 && (
        <MentionedIngredients
          mentioned={mentioned}
          onAdd={(id) => {
            addToPantry(id);
            setMentioned((prev) => prev.filter((m) => m.id !== id));
          }}
          onAddAll={() => {
            for (const m of mentioned) addToPantry(m.id);
            setMentioned([]);
          }}
        />
      )}

      {(loading || toolEvents.length > 0 || streaming) && provider === 'cloud' && (
        <StreamingTrace loading={loading} toolEvents={toolEvents} streaming={streaming} />
      )}

      {error && (
        <div className="rounded-md border border-rose-500/40 bg-rose-950/40 p-3 text-sm text-rose-200">
          {error}
        </div>
      )}

      {result && (
        <ResultView result={result} onSelect={onSelect} onSelectLlm={setSelectedLlmMatch} />
      )}

      {selectedLlmMatch && (
        <LlmRecipeModal match={selectedLlmMatch} onClose={() => setSelectedLlmMatch(null)} />
      )}
    </div>
  );
}

function MentionedIngredients({
  mentioned,
  onAdd,
  onAddAll,
}: {
  mentioned: { id: string; name: string }[];
  onAdd: (id: string) => void;
  onAddAll: () => void;
}) {
  return (
    <div className="rounded-md border border-emerald-500/30 bg-emerald-950/20 p-3 text-sm">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs uppercase tracking-wider text-emerald-300/80">
          Using these from your question
        </div>
        {mentioned.length > 1 && (
          <button
            type="button"
            onClick={onAddAll}
            className="text-xs rounded-md border border-emerald-500/40 text-emerald-300 px-2 py-0.5 hover:bg-emerald-500/10 transition"
          >
            Add all to pantry
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {mentioned.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => onAdd(m.id)}
            className="text-xs rounded-full border border-emerald-500/40 text-emerald-200 px-2.5 py-1 hover:bg-emerald-500/10 transition"
            title={`Add ${m.name} to your pantry`}
          >
            + {m.name}
          </button>
        ))}
      </div>
    </div>
  );
}

function StreamingTrace({
  loading,
  toolEvents,
  streaming,
}: {
  loading: boolean;
  toolEvents: ToolEvent[];
  streaming: string;
}) {
  return (
    <div className="rounded-md border border-amber-700/30 bg-amber-950/40 p-3 text-xs text-amber-200/80 space-y-2">
      <div className="flex items-center gap-2 text-amber-300/90">
        <span className={loading ? 'animate-pulse' : ''}>●</span>
        <span className="uppercase tracking-wider">{loading ? 'Thinking' : 'Done'}</span>
      </div>
      {toolEvents.map((e, i) => (
        <div key={i} className="font-mono text-[11px] opacity-80">
          → {e.name}({truncate(e.args, 80)})
        </div>
      ))}
      {streaming && (
        <div className="whitespace-pre-wrap font-mono text-[11px] opacity-70">{streaming}</div>
      )}
    </div>
  );
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n) + '…';
}

function ResultView({
  result,
  onSelect,
  onSelectLlm,
}: {
  result: IntentSearchResult;
  onSelect: (id: string) => void;
  onSelectLlm: (match: IntentSearchResult['matches'][number]) => void;
}) {
  const data = useData();
  return (
    <div className="flex flex-col gap-4">
      <div className="text-sm text-amber-300/80 italic">{result.interpretation}</div>
      {result.notes && (
        <div className="text-xs text-amber-400/70">{result.notes}</div>
      )}
      {result.matches.length === 0 ? (
        <div className="rounded-lg border border-amber-700/40 p-6 text-center text-amber-300/70">
          No matches — try different words or add ingredients to your pantry.
        </div>
      ) : (
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
          {result.matches.map((m) =>
            m.llmGenerated ? (
              <LlmGeneratedCard key={m.recipeId} match={m} onSelect={onSelectLlm} />
            ) : (
              <button
                key={m.recipeId}
                type="button"
                onClick={() => onSelect(m.recipeId)}
                className="text-left rounded-lg border border-amber-700/40 bg-amber-900/20 p-4 hover:border-amber-500 hover:bg-amber-900/40 transition"
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <h3 className="font-semibold text-amber-100">{m.recipeName}</h3>
                  <MakeabilityBadge makeability={m.makeability} />
                </div>
                <div className="text-xs text-amber-300/80 mb-2">{m.fitReason}</div>
                {m.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {m.tags.map((t) => (
                      <span
                        key={t}
                        className="text-[10px] uppercase tracking-wider rounded bg-amber-900/40 border border-amber-700/40 text-amber-300/80 px-1.5 py-0.5"
                      >
                        {t.replace('_', ' ')}
                      </span>
                    ))}
                  </div>
                )}
                {m.makeability === 'with_substitute' && m.substitutions.length > 0 && (
                  <div className="text-xs text-amber-300/90 mt-1 space-y-0.5">
                    {m.substitutions.map((s, i) => (
                      <div key={i}>
                        <span className="opacity-60">Use</span>{' '}
                        <span className="font-medium">{data.ingredientById.get(s.use)?.name}</span>{' '}
                        <span className="opacity-60">for</span>{' '}
                        <span className="font-medium">{data.ingredientById.get(s.original)?.name}</span>
                      </div>
                    ))}
                  </div>
                )}
                {(m.makeability === 'missing_one' || m.makeability === 'cannot_make') && m.missing.length > 0 && (
                  <div className="text-xs text-rose-300/90 mt-1">
                    Need: {m.missing.map((id) => data.ingredientById.get(id)?.name ?? id).join(', ')}
                  </div>
                )}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}

function LlmGeneratedCard({
  match,
  onSelect,
}: {
  match: IntentSearchResult['matches'][number];
  onSelect: (match: IntentSearchResult['matches'][number]) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(match)}
      className="text-left rounded-lg border border-sky-700/40 bg-sky-950/20 p-4 hover:border-sky-500 hover:bg-sky-950/40 transition"
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <h3 className="font-semibold text-amber-100">{match.recipeName}</h3>
        <span className="shrink-0 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border bg-sky-500/15 text-sky-300 border-sky-500/40">
          AI suggestion
        </span>
      </div>
      <div className="text-xs text-amber-300/80 mb-2">{match.fitReason}</div>
      {match.llmDescription && (
        <p className="text-xs text-amber-200/70 italic leading-relaxed line-clamp-2">{match.llmDescription}</p>
      )}
    </button>
  );
}

function LlmRecipeModal({
  match,
  onClose,
}: {
  match: IntentSearchResult['matches'][number];
  onClose: () => void;
}) {
  const [details, setDetails] = useState<LlmRecipeDetails | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getLlmProvider().then(async (provider) => {
      if (!provider.getLlmRecipeDetails) { setLoading(false); return; }
      try {
        const d = await provider.getLlmRecipeDetails(match.recipeName);
        if (!cancelled) setDetails(d);
      } catch { /* silent */ } finally {
        if (!cancelled) setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [match.recipeName]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-sky-700/50 bg-amber-950 p-6 shadow-2xl max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="text-xl font-bold text-amber-100">{match.recipeName}</h2>
            <span className="text-[10px] uppercase tracking-wider text-sky-300">AI suggestion · not in database</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-amber-400/60 hover:text-amber-200 transition text-lg leading-none shrink-0"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {loading && (
          <p className="text-sm text-amber-400/60 animate-pulse mb-4">Fetching recipe…</p>
        )}

        {!loading && details && (
          <>
            {(details.glass || details.garnish) && (
              <div className="flex gap-4 text-xs text-amber-400/70 mb-4 capitalize">
                {details.glass && <span>Glass: {details.glass}</span>}
                {details.garnish && <span>Garnish: {details.garnish}</span>}
              </div>
            )}

            <div className="mb-4">
              <h3 className="text-xs uppercase tracking-wider text-amber-400/60 mb-2">Ingredients</h3>
              <ul className="space-y-1">
                {details.ingredients.map((ing, i) => (
                  <li key={i} className="flex justify-between text-sm text-amber-100">
                    <span>{ing.name}</span>
                    <span className="text-amber-400/70 ml-4 shrink-0">{ing.amount}</span>
                  </li>
                ))}
              </ul>
            </div>

            {details.instructions && (
              <div className="mb-4">
                <h3 className="text-xs uppercase tracking-wider text-amber-400/60 mb-2">Instructions</h3>
                <p className="text-sm text-amber-100/90 leading-relaxed">{details.instructions}</p>
              </div>
            )}
          </>
        )}

        {!loading && !details && match.llmDescription && (
          <p className="text-sm text-amber-200/80 italic leading-relaxed mb-4">{match.llmDescription}</p>
        )}

        <p className="text-xs text-sky-400/70 border-t border-amber-800/40 pt-4">
          AI-generated — ingredients and proportions are approximate. Verify before mixing.
        </p>
      </div>
    </div>
  );
}

function MakeabilityBadge({ makeability }: { makeability: IntentSearchResult['matches'][number]['makeability'] }) {
  const map = {
    now: { label: 'Make now', cls: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' },
    with_substitute: { label: 'Sub needed', cls: 'bg-amber-500/20 text-amber-300 border-amber-500/40' },
    missing_one: { label: 'Need 1', cls: 'bg-rose-500/20 text-rose-300 border-rose-500/40' },
    cannot_make: { label: 'Stretch', cls: 'bg-stone-500/20 text-stone-300 border-stone-500/40' },
  } as const;
  const m = map[makeability];
  return (
    <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${m.cls}`}>
      {m.label}
    </span>
  );
}
