import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { IngredientCategory } from '../types';

export interface CustomIngredient {
  id: string;               // "custom_uncle_nearest_1856" (snake_case, stable key)
  name: string;             // "Uncle Nearest 1856" (humanized display name)
  category: IngredientCategory;
}

/** Convert a user-typed name to a stable snake_case custom ID. */
export function toCustomIngredientId(name: string): string {
  return (
    'custom_' +
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
  );
}

interface CustomIngredientsState {
  ingredients: CustomIngredient[];
  add: (ing: CustomIngredient) => void;
  remove: (id: string) => void;
}

export const useCustomIngredients = create<CustomIngredientsState>()(
  persist(
    (set) => ({
      ingredients: [],
      add: (ing) =>
        set((s) => {
          if (s.ingredients.some((i) => i.id === ing.id)) return s;
          return { ingredients: [...s.ingredients, ing] };
        }),
      remove: (id) =>
        set((s) => ({ ingredients: s.ingredients.filter((i) => i.id !== id) })),
    }),
    { name: 'willitcocktail-custom-ingredients' },
  ),
);
