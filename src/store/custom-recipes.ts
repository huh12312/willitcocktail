import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Recipe } from '../types';

interface CustomRecipesState {
  recipes: Recipe[];
  save: (recipe: Recipe) => void;
  remove: (recipeId: string) => void;
  clear: () => void;
}

export const useCustomRecipes = create<CustomRecipesState>()(
  persist(
    (set) => ({
      recipes: [],
      save: (recipe) =>
        set((s) => {
          if (s.recipes.some((r) => r.id === recipe.id)) return s;
          return { recipes: [...s.recipes, recipe] };
        }),
      remove: (recipeId) =>
        set((s) => ({ recipes: s.recipes.filter((r) => r.id !== recipeId) })),
      clear: () => set({ recipes: [] }),
    }),
    { name: 'willitcocktail-custom-recipes' },
  ),
);
