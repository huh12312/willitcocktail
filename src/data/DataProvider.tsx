import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { DataContextProvider } from './source';
import type { DataIndex } from './index';
import { loadDataIndex } from './loader';
import { useCustomRecipes } from '../store/custom-recipes';

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

  useEffect(() => {
    let cancelled = false;
    loadDataIndex()
      .then((data) => {
        if (!cancelled) setState({ status: 'ready', data });
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
  }, []);

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
