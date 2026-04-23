import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface LitertLmConfigState {
  modelUrl: string;
  expectedSha256: string;
  setModelUrl: (v: string) => void;
  setExpectedSha256: (v: string) => void;
}

export const useLitertLmConfig = create<LitertLmConfigState>()(
  persist(
    (set) => ({
      // Pre-populated with the Gemma 4 E2B LiteRT bundle on HuggingFace.
      // Users can override with their own hosted URL or a file:// path.
      modelUrl: import.meta.env.VITE_MODEL_URL ?? 'file:///sdcard/Android/data/com.google.ai.edge.gallery/files/Gemma_4_E2B_it/20260325/gemma4_2b_v09_obfus_fix_all_modalities_thinking.litertlm',
      expectedSha256: import.meta.env.VITE_MODEL_SHA256 ?? '',
      setModelUrl: (v) => set({ modelUrl: v.trim() }),
      setExpectedSha256: (v) => set({ expectedSha256: v.trim() }),
    }),
    { name: 'willitcocktail-litertlm-config' },
  ),
);
