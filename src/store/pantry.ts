import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface PantryState {
  ingredients: string[]; // canonical ingredient IDs
  strictMode: boolean;
  minStrength: number;
  add: (id: string) => void;
  remove: (id: string) => void;
  toggleStrict: () => void;
  setMinStrength: (n: number) => void;
  clear: () => void;
  has: (id: string) => boolean;
}

export const usePantry = create<PantryState>()(
  persist(
    (set, get) => ({
      ingredients: [],
      strictMode: false,
      minStrength: 0.7,
      add: (id) =>
        set((s) => {
          if (s.ingredients.includes(id)) return s;
          return { ingredients: [...s.ingredients, id] };
        }),
      remove: (id) =>
        set((s) => ({
          ingredients: s.ingredients.filter((x) => x !== id),
        })),
      toggleStrict: () => set((s) => ({ strictMode: !s.strictMode })),
      setMinStrength: (n) => set({ minStrength: n }),
      clear: () => set({ ingredients: [] }),
      has: (id) => get().ingredients.includes(id),
    }),
    { name: 'willitcocktail-pantry' },
  ),
);
