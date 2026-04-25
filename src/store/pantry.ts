import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface PantryState {
  ingredients: string[]; // canonical ingredient IDs (persisted)
  _set: Set<string>;     // O(1) lookup mirror (rebuilt on rehydration, not persisted)
  strictMode: boolean;
  classicsOnly: boolean;
  minStrength: number;
  add: (id: string) => void;
  remove: (id: string) => void;
  toggleStrict: () => void;
  toggleClassicsOnly: () => void;
  setMinStrength: (n: number) => void;
  clear: () => void;
  has: (id: string) => boolean;
}

export const usePantry = create<PantryState>()(
  persist(
    (set, get) => ({
      ingredients: [],
      _set: new Set<string>(),
      strictMode: false,
      classicsOnly: false,
      minStrength: 0.7,
      add: (id) =>
        set((s) => {
          if (s._set.has(id)) return s;
          const _set = new Set(s._set);
          _set.add(id);
          return { ingredients: [...s.ingredients, id], _set };
        }),
      remove: (id) =>
        set((s) => {
          const _set = new Set(s._set);
          _set.delete(id);
          return { ingredients: s.ingredients.filter((x) => x !== id), _set };
        }),
      toggleStrict: () => set((s) => ({ strictMode: !s.strictMode })),
      toggleClassicsOnly: () => set((s) => ({ classicsOnly: !s.classicsOnly })),
      setMinStrength: (n) => set({ minStrength: n }),
      clear: () => set({ ingredients: [], _set: new Set() }),
      has: (id) => get()._set.has(id),
    }),
    {
      name: 'willitcocktail-pantry',
      partialize: (s) => ({
        ingredients: s.ingredients,
        strictMode: s.strictMode,
        classicsOnly: s.classicsOnly,
        minStrength: s.minStrength,
      }),
      // Rebuild the in-memory Set after persisted state is loaded.
      onRehydrateStorage: () => (state) => {
        if (state) state._set = new Set(state.ingredients);
      },
    },
  ),
);
