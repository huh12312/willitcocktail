import { createContext, useContext } from 'react';
import type { DataIndex } from './index';

// Runtime DataIndex context. Populated by <DataProvider>. Matcher and UI
// components read via useData(). Tests still use DATA singleton directly.
const DataContext = createContext<DataIndex | null>(null);

export const DataContextProvider = DataContext.Provider;

export function useData(): DataIndex {
  const ctx = useContext(DataContext);
  if (!ctx) {
    throw new Error('useData must be used within DataProvider');
  }
  return ctx;
}
