import type { DataIndex } from '../data';
import type {
  IntentSearchResult,
  LlmProvider,
  ParsedPantry,
} from './provider';

// Shape the native Capacitor plugin is expected to implement.
// See src/llm/README.md for the Kotlin / LiteRT-LM implementation plan.
export interface LiteRtLmPlugin {
  modelStatus(): Promise<{ downloaded: boolean; sizeMb?: number; path?: string }>;
  downloadModel(opts: { url: string }): Promise<{ path: string }>;
  addDownloadListener(
    cb: (e: { bytesDownloaded: number; totalBytes: number }) => void,
  ): Promise<{ remove: () => Promise<void> }>;
  runInference(opts: {
    system: string;
    messages: { role: 'user' | 'assistant' | 'tool'; content: string; toolCallId?: string }[];
    tools?: unknown[];
    maxTokens?: number;
    temperature?: number;
    jsonSchema?: unknown;
  }): Promise<{
    content: string;
    toolCalls?: { id: string; name: string; arguments: string }[];
    stopReason: 'stop' | 'length' | 'tool_call';
  }>;
}

export class LitertLmProvider implements LlmProvider {
  readonly id = 'litert-lm';
  readonly label = 'On-device (Gemma)';
  readonly requiresModelDownload = true;

  async isAvailable(): Promise<boolean> {
    return false;
  }

  async parseIngredients(_input: string, _data: DataIndex): Promise<ParsedPantry> {
    throw new Error('LitertLmProvider is not available on this platform yet.');
  }

  async searchIntent(
    _query: string,
    _pantryIds: string[],
    _data: DataIndex,
  ): Promise<IntentSearchResult> {
    throw new Error('LitertLmProvider is not available on this platform yet.');
  }
}
