import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ProviderChoice = 'auto' | 'cloud' | 'heuristic';

export interface CloudConfig {
  baseUrl: string;
  model: string;
  apiKey: string;
}

export interface LlmPreset {
  label: string;
  baseUrl: string;
  model: string;
}

export const LLM_PRESETS: LlmPreset[] = [
  { label: 'OpenAI (gpt-4o-mini)', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  { label: 'OpenAI (gpt-4o)', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o' },
  { label: 'Gemini (2.0 Flash)', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-2.0-flash' },
  { label: 'Gemini (2.5 Flash)', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-2.5-flash' },
  { label: 'Anthropic (Haiku 4.5)', baseUrl: 'https://api.anthropic.com/v1', model: 'claude-haiku-4-5-20251001' },
  { label: 'Anthropic (Sonnet 4.5)', baseUrl: 'https://api.anthropic.com/v1', model: 'claude-sonnet-4-5' },
  { label: 'Groq (Llama 3.3 70B)', baseUrl: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile' },
  { label: 'Ollama (local)', baseUrl: 'http://localhost:11434/v1', model: 'llama3.2' },
];

interface LlmSettingsState {
  choice: ProviderChoice;
  cloud: CloudConfig;
  setChoice: (c: ProviderChoice) => void;
  setCloud: (patch: Partial<CloudConfig>) => void;
  applyPreset: (p: LlmPreset) => void;
}

export const useLlmSettings = create<LlmSettingsState>()(
  persist(
    (set) => ({
      choice: 'auto',
      cloud: { baseUrl: '', model: '', apiKey: '' },
      setChoice: (choice) => set({ choice }),
      setCloud: (patch) => set((s) => ({ cloud: { ...s.cloud, ...patch } })),
      applyPreset: (p) =>
        set((s) => ({
          cloud: { ...s.cloud, baseUrl: p.baseUrl, model: p.model },
        })),
    }),
    { name: 'willitcocktail.llm' },
  ),
);

export function isCloudConfigured(c: CloudConfig): boolean {
  return Boolean(c.baseUrl.trim() && c.model.trim() && c.apiKey.trim());
}
