import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { DataContextProvider } from './source';
import type { DataIndex } from './index';
import { loadDataIndex } from './loader';
import { checkAndInstallSnapshot, snapshotConfigFromEnv } from './snapshot';
import { useCustomRecipes } from '../store/custom-recipes';
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
  const setCurrent = useSnapshotStatus((s) => s.setCurrent);
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
        if (!Capacitor.isNativePlatform()) {
          try {
            const { getDbMeta } = await import('./sqlite-web');
            const meta = await getDbMeta();
            const localVersion = meta.version ?? null;
            setCurrent(localVersion);
            const cfg = snapshotConfigFromEnv();
            if (cfg) {
              const result = await checkAndInstallSnapshot(cfg, localVersion);
              if (!cancelled) applySync(result);
            }
          } catch {
            /* non-fatal: stay on whatever loaded */
          }
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
  }, [setCurrent, applySync]);

  const merged = useMemo(() => {
    if (state.status !== 'ready') return null;
    if (customRecipes.length === 0) return state.data;
    // Spread into a new DataIndex so consumers see a stable reference change.
    return {
      ...state.data,
      recipes: [...state.data.recipes, ...customRecipes],
    };
  }, [state, customRecipes]);

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
