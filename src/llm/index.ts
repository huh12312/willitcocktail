import { HeuristicProvider } from './heuristic';
import { LitertLmProvider, getLiteRtLmPlugin } from './litert-lm';
import { OpenAiCompatProvider } from './openai-compat';
import type { LlmProvider } from './provider';
import { useLlmSettings, isCloudConfigured, type ProviderChoice } from './settings';
import { Capacitor } from '@capacitor/core';

export type { LlmProvider, ParsedPantry, IntentMatch, IntentSearchResult, LlmRecipeDetails, InventedRecipe } from './provider';
export { HeuristicProvider } from './heuristic';
export { LitertLmProvider } from './litert-lm';
export { OpenAiCompatProvider } from './openai-compat';
export { useLlmSettings, isCloudConfigured, LLM_PRESETS } from './settings';
export type { CloudConfig, ProviderChoice, LlmPreset } from './settings';

let cachedHeuristic: HeuristicProvider | null = null;
let cachedLitert: LitertLmProvider | null = null;

export interface GetProviderOptions {
  onToken?: (tok: string) => void;
  onToolCall?: (name: string, args: string) => void;
  signal?: AbortSignal;
}

/**
 * Resolve the active provider.
 * Priority (when choice = 'auto'): LitertLM (Android on-device) → Cloud → Heuristic.
 * User can override via `choice` in llm settings.
 */
export async function getLlmProvider(opts: GetProviderOptions = {}): Promise<LlmProvider> {
  const { choice, cloud } = useLlmSettings.getState();

  if (shouldTry(choice, 'litert-lm')) {
    const litert = (cachedLitert ??= new LitertLmProvider());
    if (await litert.isAvailable()) return litert;
  }

  if (shouldTry(choice, 'cloud') && isCloudConfigured(cloud)) {
    return new OpenAiCompatProvider({
      config: cloud,
      onToken: opts.onToken,
      onToolCall: opts.onToolCall,
      signal: opts.signal,
    });
  }

  return (cachedHeuristic ??= new HeuristicProvider());
}

function shouldTry(choice: ProviderChoice, id: 'litert-lm' | 'cloud' | 'heuristic'): boolean {
  if (choice === 'auto') return true;
  if (choice === 'litert-lm') return id === 'litert-lm';
  if (choice === 'cloud') return id === 'cloud';
  if (choice === 'heuristic') return id === 'heuristic';
  return false;
}

export function activeProviderId(): 'litert-lm' | 'cloud' | 'heuristic' {
  const { choice, cloud } = useLlmSettings.getState();
  const hasPlugin = Capacitor.isNativePlatform() && !!getLiteRtLmPlugin();

  if (choice === 'litert-lm') return hasPlugin ? 'litert-lm' : 'heuristic';
  if (choice === 'cloud' && isCloudConfigured(cloud)) return 'cloud';
  if (choice === 'heuristic') return 'heuristic';
  // auto: mirrors getLlmProvider() priority order (sync proxy — model download
  // check is async so plugin presence is used as a stand-in)
  if (hasPlugin) return 'litert-lm';
  if (isCloudConfigured(cloud)) return 'cloud';
  return 'heuristic';
}
