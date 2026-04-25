import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { DataContextProvider } from './source';
import type { DataIndex } from './index';
import { loadDataIndex } from './loader';
import { checkAndInstallSnapshot, snapshotConfigFromEnv } from './snapshot';
import { useCustomRecipes } from '../store/custom-recipes';
import { useCustomIngredients } from '../store/custom-ingredients';
import { useSnapshotStatus } from '../store/snapshot-status';
import { Capacitor } from '@capacitor/core';

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; data: DataIndex }
  | { status: 'error'; error: Error };

interface DataProviderProps {
  children: ReactNode;
  fallback?: ReactNode;
}

export function DataProvider({ children, fallback }: DataProviderProps) {
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const customRecipes = useCustomRecipes((s) => s.recipes);
  const customIngredients = useCustomIngredients((s) => s.ingredients);
  const setCurrent = useSnapshotStatus((s) => s.setCurrent);
  const clearPending = useSnapshotStatus((s) => s.clearPending);
  const applySync = useSnapshotStatus((s) => s.applySync);

  useEffect(() => {
    let cancelled = false;
    loadDataIndex()
      .then(async (data) => {
        if (cancelled) return;
        setState({ status: 'ready', data });
        // Read the version stamp from whichever DB actually loaded (bundled
        // or previously installed snapshot) before kicking off the remote
        // check — avoids flashing a stale "checking…" against the wrong
        // baseline.
        try {
          const meta = Capacitor.isNativePlatform()
            ? await import('./sqlite-native').then((m) => m.getDbMeta())
            : await import('./sqlite-web').then((m) => m.getDbMeta());
          const localVersion = meta.version ?? null;
          setCurrent(localVersion);
          if (Capacitor.isNativePlatform()) {
            // Native doesn't use the snapshot system — clear any stale
            // pendingVersion so the "Reload to apply" banner never gets stuck.
            clearPending();
          } else {
            const cfg = snapshotConfigFromEnv();
            if (cfg) {
              const result = await checkAndInstallSnapshot(cfg, localVersion);
              if (!cancelled) applySync(result);
            }
          }
        } catch {
          /* non-fatal: stay on whatever loaded */
        }
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setState({
            status: 'error',
            error: err instanceof Error ? err : new Error(String(err)),
          });
      });
    return () => {
      cancelled = true;
    };
  }, [setCurrent, clearPending, applySync]);

  const merged = useMemo(() => {
    if (state.status !== 'ready') return null;
    if (customRecipes.length === 0 && customIngredients.length === 0) return state.data;

    // Merge custom ingredients into the DataIndex so the matcher, alias
    // resolver, and LLM prompts all treat them as first-class ingredients.
    // custom:true lets the UI distinguish them without relying on a prefix.
    // We skip any ID that already exists in the canonical DB — the canonical
    // entry wins (e.g. if someone types "gin" as a custom ingredient).
    const extraIngredients = customIngredients
      .filter((ci) => !state.data.ingredientById.has(ci.id))
      .map((ci) => ({ id: ci.id, name: ci.name, category: ci.category, custom: true as const }));

    const ingredientById = new Map(state.data.ingredientById);
    const aliasMap = new Map(state.data.aliasMap);
    const descendants = new Map(state.data.descendants);
    const ancestors = new Map(state.data.ancestors);
    const recipeById = new Map(state.data.recipeById);
    for (const ing of extraIngredients) {
      ingredientById.set(ing.id, ing);
      // Humanized name as alias so the heuristic resolver can match it.
      if (!aliasMap.has(ing.name.toLowerCase())) aliasMap.set(ing.name.toLowerCase(), ing.id);
      // Leaf nodes: only contain themselves in hierarchy maps.
      descendants.set(ing.id, new Set([ing.id]));
      ancestors.set(ing.id, new Set([ing.id]));
    }
    for (const r of customRecipes) recipeById.set(r.id, r);

    return {
      ...state.data,
      ingredients: [...state.data.ingredients, ...extraIngredients],
      ingredientById,
      aliasMap,
      descendants,
      ancestors,
      recipes: [...state.data.recipes, ...customRecipes],
      recipeById,
    };
  }, [state, customRecipes, customIngredients]);

  if (state.status === 'loading' || !merged) {
    return <>{fallback ?? <LoadingSplash />}</>;
  }
  if (state.status === 'error') {
    return <ErrorSplash error={state.error} />;
  }
  return <DataContextProvider value={merged}>{children}</DataContextProvider>;
}

function LoadingSplash() {
  return (
    <div className="flex items-center justify-center min-h-full p-8">
      <div className="text-amber-300/70 text-sm animate-pulse">Loading cocktails…</div>
    </div>
  );
}

function ErrorSplash({ error }: { error: Error }) {
  return (
    <div className="flex items-center justify-center min-h-full p-8">
      <div className="max-w-md rounded-lg border border-rose-500/40 bg-rose-950/40 p-4 text-sm">
        <div className="font-semibold text-rose-200 mb-1">Could not load cocktails database</div>
        <div className="text-rose-200/80">{error.message}</div>
      </div>
    </div>
  );
}
