import { useEffect, useState } from 'react';
import { LLM_PRESETS, isCloudConfigured, useLlmSettings } from '../llm';

interface LlmSettingsProps {
  open: boolean;
  onClose: () => void;
}

export function LlmSettings({ open, onClose }: LlmSettingsProps) {
  const { choice, cloud, setChoice, setCloud, applyPreset } = useLlmSettings();
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const configured = isCloudConfigured(cloud);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-lg border border-amber-700/40 bg-stone-950 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-amber-100">LLM settings</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-amber-400/60 hover:text-amber-200"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <section className="mb-5">
          <label className="text-xs uppercase tracking-wider text-amber-400/70">
            Provider
          </label>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {(['auto', 'cloud', 'heuristic'] as const).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setChoice(c)}
                className={[
                  'px-3 py-2 text-sm rounded-md border transition',
                  choice === c
                    ? 'bg-amber-500 text-amber-950 border-amber-400'
                    : 'border-amber-700/40 text-amber-200 hover:border-amber-500',
                ].join(' ')}
              >
                {c === 'auto' ? 'Auto' : c === 'cloud' ? 'Cloud' : 'Heuristic'}
              </button>
            ))}
          </div>
          <p className="text-xs text-amber-400/60 mt-2">
            Auto picks on-device (Android) if available, then cloud, then the offline heuristic.
          </p>
        </section>

        <section className="mb-5">
          <label className="text-xs uppercase tracking-wider text-amber-400/70">
            Preset
          </label>
          <select
            className="mt-2 w-full rounded-md bg-amber-950/40 border border-amber-700/40 px-3 py-2 text-sm text-amber-100 focus:outline-none focus:border-amber-500"
            value=""
            onChange={(e) => {
              const p = LLM_PRESETS.find((p) => p.label === e.target.value);
              if (p) applyPreset(p);
            }}
          >
            <option value="" disabled>
              Choose a preset…
            </option>
            {LLM_PRESETS.map((p) => (
              <option key={p.label} value={p.label}>
                {p.label}
              </option>
            ))}
          </select>
        </section>

        <section className="mb-5">
          <label className="text-xs uppercase tracking-wider text-amber-400/70">
            Base URL
          </label>
          <input
            type="url"
            placeholder="https://api.openai.com/v1"
            value={cloud.baseUrl}
            onChange={(e) => setCloud({ baseUrl: e.target.value })}
            className="mt-2 w-full rounded-md bg-amber-950/40 border border-amber-700/40 px-3 py-2 text-sm text-amber-100 placeholder:text-amber-500/40 focus:outline-none focus:border-amber-500"
          />
        </section>

        <section className="mb-5">
          <label className="text-xs uppercase tracking-wider text-amber-400/70">
            Model
          </label>
          <input
            type="text"
            placeholder="gpt-4o-mini"
            value={cloud.model}
            onChange={(e) => setCloud({ model: e.target.value })}
            className="mt-2 w-full rounded-md bg-amber-950/40 border border-amber-700/40 px-3 py-2 text-sm text-amber-100 placeholder:text-amber-500/40 focus:outline-none focus:border-amber-500"
          />
        </section>

        <section className="mb-5">
          <label className="text-xs uppercase tracking-wider text-amber-400/70">
            API key
          </label>
          <div className="mt-2 flex gap-2">
            <input
              type={showKey ? 'text' : 'password'}
              autoComplete="off"
              placeholder="sk-..."
              value={cloud.apiKey}
              onChange={(e) => setCloud({ apiKey: e.target.value })}
              className="flex-1 rounded-md bg-amber-950/40 border border-amber-700/40 px-3 py-2 text-sm text-amber-100 placeholder:text-amber-500/40 focus:outline-none focus:border-amber-500"
            />
            <button
              type="button"
              onClick={() => setShowKey((v) => !v)}
              className="rounded-md border border-amber-700/40 px-3 py-2 text-sm text-amber-300/80 hover:border-amber-500"
            >
              {showKey ? 'Hide' : 'Show'}
            </button>
          </div>
          <p className="text-xs text-amber-400/60 mt-2">
            Stored in your browser&apos;s localStorage. Never sent anywhere except the base URL above.
          </p>
        </section>

        <div className="flex items-center justify-between pt-3 border-t border-amber-800/30">
          <div className="text-xs">
            {choice === 'heuristic' ? (
              <span className="text-amber-400/70">Offline heuristic selected.</span>
            ) : configured ? (
              <span className="text-emerald-400">Cloud configured.</span>
            ) : (
              <span className="text-rose-300/80">Cloud not configured — falling back to heuristic.</span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md bg-amber-500 text-amber-950 px-4 py-2 text-sm font-medium hover:bg-amber-400 transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
