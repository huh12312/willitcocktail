import { useEffect, useMemo, useRef, useState } from 'react';
import { useData } from '../data/source';
import { usePantry } from '../store/pantry';
import { useCustomRecipes } from '../store/custom-recipes';
import { getLlmProvider, HeuristicProvider } from '../llm';
import { extractQueryIngredients } from '../llm/utils';

import type { IntentSearchResult, InventedRecipe, LlmRecipeDetails } from '../llm';
import type { Recipe } from '../types';

interface AskPanelProps {
  onSelect: (id: string) => void;
}

const EXAMPLES = [
  'Something refreshing and citrusy',
  'A bitter, spirit-forward stirred drink',
  'Herbal gin cocktail',
  'Tropical rum drink',
];

export function AskPanel({ onSelect }: AskPanelProps) {
  const data = useData();
  const pantryIds = usePantry((s) => s.ingredients);
  const addToPantry = usePantry((s) => s.add);
  const saveCustom = useCustomRecipes((s) => s.save);
  const removeCustom = useCustomRecipes((s) => s.remove);
  const savedRecipes = useCustomRecipes((s) => s.recipes);

  const [query, setQuery] = useState('');
  const [mentioned, setMentioned] = useState<{ id: string; name: string }[]>([]);

  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResult, setSearchResult] = useState<IntentSearchResult | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [openSearch, setOpenSearch] = useState(false);

  const [inventLoading, setInventLoading] = useState(false);
  const [invented, setInvented] = useState<InventedRecipe[]>([]);
  const [openInvent, setOpenInvent] = useState(false);

  const [selectedLlmMatch, setSelectedLlmMatch] = useState<IntentSearchResult['matches'][number] | null>(null);
  const [selectedInvented, setSelectedInvented] = useState<InventedRecipe | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const heuristic = useMemo(() => new HeuristicProvider(), []);
  const savedIds = useMemo(() => new Set(savedRecipes.map((r) => r.id)), [savedRecipes]);

  // Stable ID derived from the invention name — must match the id assigned in saveInvented().
  function inventedRecipeId(inv: InventedRecipe): string {
    return `gen_${inv.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')}`;
  }

  async function run(q: string) {
    const trimmed = q.trim();
    if (!trimmed) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setSearchLoading(true);
    setInventLoading(true);
    setSearchError(null);
    setSearchResult(null);
    setInvented([]);
    setMentioned([]);
    setOpenSearch(false);
    setOpenInvent(false);

    // Scan the full query for all ingredient mentions (word-boundary, multi-extract).
    // This correctly handles "basil forward vodka drink" → [basil, vodka], unlike
    // parseIngredients which splits on delimiters and returns only the first hit.
    const pantrySet = new Set(pantryIds);
    const mentionedIds = extractQueryIngredients(trimmed, data);
    const newMentions = mentionedIds
      .filter((id) => !pantrySet.has(id))
      .map((id) => ({ id, name: data.ingredientById.get(id)?.name ?? id }));
    setMentioned(newMentions);

    const expandedPantry = [...new Set([...pantryIds, ...mentionedIds])];

    // "From our recipes" always uses the heuristic — fast, offline, deterministic.
    heuristic.searchIntent(trimmed, expandedPantry, data)
      .then((res) => {
        if (!ctrl.signal.aborted) {
          setSearchResult(res);
          setOpenSearch(true);
        }
      })
      .catch((err) => { if (!ctrl.signal.aborted) setSearchError(err instanceof Error ? err.message : String(err)); })
      .finally(() => { if (abortRef.current === ctrl) setSearchLoading(false); });

    // "Created for you" uses the full LLM provider.
    // Pass expandedPantry so ingredients mentioned in the query inform invention
    // the same way they inform the search results.
    getLlmProvider({ signal: ctrl.signal })
      .then((provider) =>
        (provider.inventFromPantry
          ? provider.inventFromPantry(trimmed, expandedPantry, data)
          : Promise.resolve([])
        )
          .then((res) => {
            if (!ctrl.signal.aborted) {
              setInvented(res);
              if (res.length > 0) setOpenInvent(true);
            }
          })
          .catch(() => { /* silent — search results stand alone */ }),
      )
      .catch(() => { /* getLlmProvider itself failed */ })
      .finally(() => { if (abortRef.current === ctrl) setInventLoading(false); });
  }

  function cancel() {
    abortRef.current?.abort();
    setSearchLoading(false);
    setInventLoading(false);
  }

  function saveInvented(inv: InventedRecipe) {
    const alsoNote = inv.alsoNeeded.length > 0
      ? `\n\nAlso works well with: ${inv.alsoNeeded.join(', ')}.`
      : '';
    const recipe: Recipe = {
      id: inventedRecipeId(inv),
      name: inv.name,
      family: inv.family,
      method: inv.method,
      glass: inv.glass,
      garnish: inv.garnish,
      instructions: inv.instructions + alsoNote,
      source: 'user',
      ingredients: inv.ingredients,
    };
    saveCustom(recipe);
  }

  const loading = searchLoading || inventLoading;

  return (
    <div className="flex flex-col gap-5">
      <form
        onSubmit={(e) => { e.preventDefault(); void run(query); }}
        className="flex flex-col gap-2"
      >
        <label className="text-sm text-amber-300/80" htmlFor="ask-input">
          What are you in the mood for?
        </label>
        <div className="flex gap-2">
          <input
            id="ask-input"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. something bitter and stirred"
            className="flex-1 rounded-md bg-amber-950/40 border border-amber-700/40 px-3 py-2 text-amber-100 placeholder:text-amber-500/50 focus:outline-hidden focus:border-amber-500"
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
              onClick={() => { setQuery(ex); void run(ex); }}
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
          onAdd={(id) => { addToPantry(id); setMentioned((prev) => prev.filter((m) => m.id !== id)); }}
          onAddAll={() => { for (const m of mentioned) addToPantry(m.id); setMentioned([]); }}
        />
      )}

      {searchError && (
        <div className="rounded-md border border-rose-500/40 bg-rose-950/40 p-3 text-sm text-rose-200">
          {searchError}
        </div>
      )}

      {/* From our recipes */}
      {(searchLoading || searchResult) && (
        <CollapsibleSection
          title="From our recipes"
          loading={searchLoading}
          loadingLabel="Searching…"
          count={searchResult?.matches.length ?? 0}
          open={openSearch}
          onToggle={() => setOpenSearch((o) => !o)}
        >
          {searchResult && (
            <SearchResultView
              result={searchResult}
              onSelect={onSelect}
              onSelectLlm={setSelectedLlmMatch}
            />
          )}
        </CollapsibleSection>
      )}

      {/* Created for you */}
      {(inventLoading || invented.length > 0) && (
        <CollapsibleSection
          title="Created for you"
          loading={inventLoading}
          loadingLabel="Inventing…"
          count={invented.length}
          open={openInvent}
          onToggle={() => setOpenInvent((o) => !o)}
        >
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
            {invented.map((inv, i) => (
              <InventedCard
                key={i}
                inv={inv}
                data={data}
                saved={savedIds.has(inventedRecipeId(inv))}
                onSave={() => saveInvented(inv)}
                onOpen={() => setSelectedInvented(inv)}
              />
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Saved inventions */}
      {savedRecipes.length > 0 && (
        <section className="flex flex-col gap-3 mt-2">
          <h2 className="text-xs uppercase tracking-wider text-emerald-400/60">
            Saved inventions
          </h2>
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
            {savedRecipes.map((r) => (
              <div key={r.id} className="rounded-lg border border-emerald-700/40 bg-emerald-900/10 p-4">
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

      {selectedLlmMatch && (
        <LlmRecipeModal match={selectedLlmMatch} onClose={() => setSelectedLlmMatch(null)} />
      )}
      {selectedInvented && (
        <InventedRecipeModal
          inv={selectedInvented}
          data={data}
          saved={savedIds.has(inventedRecipeId(selectedInvented))}
          onSave={() => saveInvented(selectedInvented)}
          onClose={() => setSelectedInvented(null)}
        />
      )}
    </div>
  );
}

function humanizeInstructions(text: string, data: ReturnType<typeof useData>): string {
  // Replace canonical snake_case IDs in model-generated instructions with
  // their human-readable display names (e.g. "gin_london_dry" → "London Dry Gin").
  return text.replace(/\b([a-z][a-z0-9]*(?:_[a-z0-9]+)+)\b/g, (match) => {
    const ing = data.ingredientById.get(match);
    return ing ? ing.name : match;
  });
}

function CollapsibleSection({
  title,
  loading,
  loadingLabel,
  count,
  open,
  onToggle,
  children,
}: {
  title: string;
  loading: boolean;
  loadingLabel: string;
  count: number;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <button
        type="button"
        onClick={onToggle}
        disabled={loading || count === 0}
        className="flex items-center justify-between w-full group disabled:cursor-default"
      >
        <span className="text-xs uppercase tracking-wider text-amber-400/60 group-hover:text-amber-300/80 transition group-disabled:group-hover:text-amber-400/60">
          {title}
        </span>
        <span className="flex items-center gap-2">
          {loading ? (
            <span className="text-xs text-amber-400/50 normal-case animate-pulse">{loadingLabel}</span>
          ) : count > 0 ? (
            <>
              <span className="text-[10px] rounded-full bg-amber-900/50 border border-amber-700/40 text-amber-300/70 px-2 py-0.5">
                {count}
              </span>
              <span className="text-amber-400/50 text-xs">{open ? '▲' : '▼'}</span>
            </>
          ) : (
            <span className="text-xs text-amber-500/40">none</span>
          )}
        </span>
      </button>
      {open && !loading && children}
    </section>
  );
}

function InventedCard({
  inv,
  data,
  saved,
  onSave,
  onOpen,
}: {
  inv: InventedRecipe;
  data: ReturnType<typeof useData>;
  saved: boolean;
  onSave: () => void;
  onOpen: () => void;
}) {
  return (
    <div className="rounded-lg border border-violet-700/40 bg-violet-950/20 p-4 flex flex-col gap-2">
      <button type="button" onClick={onOpen} className="text-left">
        <div className="flex items-start justify-between gap-2 mb-1">
          <div>
            <h3 className="font-semibold text-amber-100 hover:text-amber-300 transition">{inv.name}</h3>
            <div className="text-xs text-amber-400/70 capitalize">
              {inv.family.replace('_', ' ')} · {inv.method}
            </div>
          </div>
          <span className="shrink-0 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border bg-violet-500/15 text-violet-300 border-violet-500/40">
            Invented
          </span>
        </div>
        <div className="text-xs text-amber-300/60">
          {inv.ingredients.length} ingredient{inv.ingredients.length === 1 ? '' : 's'}
          {inv.missing.length > 0 && (
            <span className="text-rose-300/80 ml-1">
              · Need: {inv.missing.map((id) => data.ingredientById.get(id)?.name ?? id).join(', ')}
            </span>
          )}
        </div>
      </button>
      <button
        type="button"
        onClick={onSave}
        disabled={saved}
        className="self-start text-xs rounded-md border border-emerald-500/40 text-emerald-200 px-2.5 py-1 hover:bg-emerald-500/10 transition disabled:opacity-50"
      >
        {saved ? 'Saved' : 'Save'}
      </button>
    </div>
  );
}

function InventedRecipeModal({
  inv,
  data,
  saved,
  onSave,
  onClose,
}: {
  inv: InventedRecipe;
  data: ReturnType<typeof useData>;
  saved: boolean;
  onSave: () => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-violet-700/50 bg-amber-950 p-6 shadow-2xl max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="text-xl font-bold text-amber-100">{inv.name}</h2>
            <div className="text-xs text-amber-400/70 capitalize mt-0.5">
              {inv.family.replace('_', ' ')} · {inv.method} · {inv.glass.replace('_', ' ')}
              {inv.garnish && <span> · {inv.garnish}</span>}
            </div>
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

        <div className="mb-4">
          <h3 className="text-xs uppercase tracking-wider text-amber-400/60 mb-2">Ingredients</h3>
          <ul className="space-y-1">
            {inv.ingredients.map((ri) => {
              const isMissing = inv.missing.includes(ri.ingredientId);
              return (
                <li key={`${ri.ingredientId}-${ri.position}`} className="flex justify-between text-sm">
                  <span className={isMissing ? 'text-rose-300/80' : 'text-amber-100'}>
                    {isMissing && <span className="text-[10px] uppercase tracking-wider mr-1 opacity-70">need</span>}
                    {data.ingredientById.get(ri.ingredientId)?.name ?? ri.ingredientId}
                  </span>
                  <span className="text-amber-400/70 ml-4 shrink-0 font-mono text-xs">{ri.amountDisplay}</span>
                </li>
              );
            })}
          </ul>
        </div>

        {inv.alsoNeeded.length > 0 && (
          <div className="mb-4 rounded-md border border-amber-600/30 bg-amber-900/20 px-3 py-2.5">
            <h3 className="text-xs uppercase tracking-wider text-amber-400/60 mb-1.5">Also works well with</h3>
            <ul className="space-y-1">
              {inv.alsoNeeded.map((item, i) => (
                <li key={i} className="text-sm text-amber-300/90">+ {item}</li>
              ))}
            </ul>
          </div>
        )}

        {inv.instructions && (
          <div className="mb-4">
            <h3 className="text-xs uppercase tracking-wider text-amber-400/60 mb-2">Instructions</h3>
            <p className="text-sm text-amber-100/90 leading-relaxed">
              {humanizeInstructions(inv.instructions, data)}
            </p>
          </div>
        )}

        {inv.reasoning && (
          <p className="text-xs text-amber-400/60 italic mb-4">{inv.reasoning}</p>
        )}

        <div className="flex items-center justify-between pt-4 border-t border-amber-800/40">
          <p className="text-xs text-violet-400/70">AI-generated · verify before mixing</p>
          <button
            type="button"
            onClick={() => { onSave(); onClose(); }}
            disabled={saved}
            className="text-xs rounded-md border border-emerald-500/40 text-emerald-200 px-3 py-1.5 hover:bg-emerald-500/10 transition disabled:opacity-50"
          >
            {saved ? 'Saved' : 'Save recipe'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Existing search result components (unchanged) ─────────────────────────────

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
          >
            + {m.name}
          </button>
        ))}
      </div>
    </div>
  );
}

function SearchResultView({
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
    <div className="flex flex-col gap-3">
      <div className="text-sm text-amber-300/80 italic">{result.interpretation}</div>
      {result.notes && <div className="text-xs text-amber-400/70">{result.notes}</div>}
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
    getLlmProvider()
      .then(async (provider) => {
        if (!provider.getLlmRecipeDetails) return;
        const d = await provider.getLlmRecipeDetails(match.recipeName);
        if (!cancelled) setDetails(d);
      })
      .catch(() => { /* silent — fall through to description fallback */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [match.recipeName]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
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
          <button type="button" onClick={onClose} className="text-amber-400/60 hover:text-amber-200 transition text-lg leading-none shrink-0" aria-label="Close">
            ✕
          </button>
        </div>

        {loading && <p className="text-sm text-amber-400/60 animate-pulse mb-4">Fetching recipe…</p>}

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
          AI-generated — ingredients and proportions are approximate.
        </p>
      </div>
    </div>
  );
}

function MakeabilityBadge({ makeability }: { makeability: IntentSearchResult['matches'][number]['makeability'] }) {
  const map = {
    now:            { label: 'Make now',  cls: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' },
    with_substitute:{ label: 'Sub needed',cls: 'bg-amber-500/20  text-amber-300  border-amber-500/40'  },
    missing_one:    { label: 'Need 1',    cls: 'bg-rose-500/20   text-rose-300   border-rose-500/40'   },
    cannot_make:    { label: 'Stretch',   cls: 'bg-stone-500/20  text-stone-300  border-stone-500/40'  },
  } as const;
  const m = map[makeability];
  return (
    <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${m.cls}`}>
      {m.label}
    </span>
  );
}
