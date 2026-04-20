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
      modelUrl: '',
      expectedSha256: '',
      setModelUrl: (v) => set({ modelUrl: v.trim() }),
      setExpectedSha256: (v) => set({ expectedSha256: v.trim() }),
    }),
    { name: 'willitcocktail-litertlm-config' },
  ),
);
