import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { LLM_PRESETS, isCloudConfigured, useLlmSettings } from '../llm';
import { useSnapshotStatus } from '../store/snapshot-status';
import { checkAndInstallSnapshot, snapshotConfigFromEnv } from '../data/snapshot';
import { useLitertLmConfig } from '../store/litertlm-config';
import { getLiteRtLmPlugin, type ModelStatus } from '../llm/litert-lm';

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
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-lg border border-amber-700/40 bg-stone-950 p-5"
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
          <div className="mt-2 grid grid-cols-2 gap-2">
            {([
              ['auto', 'Auto'],
              ['litert-lm', 'On-device'],
              ['cloud', 'Cloud'],
              ['heuristic', 'Heuristic'],
            ] as const).map(([c, label]) => (
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
                {label}
              </button>
            ))}
          </div>
          <p className="text-xs text-amber-400/60 mt-2">
            Auto picks on-device if model is downloaded, then cloud, then the offline heuristic.
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

        <OnDeviceModelSection />

        <DbSnapshotSection />

        <div className="flex items-center justify-between pt-3 border-t border-amber-800/30">
          <div className="text-xs">
            {choice === 'heuristic' ? (
              <span className="text-amber-400/70">Offline heuristic selected.</span>
            ) : choice === 'litert-lm' ? (
              <span className="text-amber-400/70">On-device forced — falls back to heuristic if not ready.</span>
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

function OnDeviceModelSection() {
  const { modelUrl, expectedSha256, setModelUrl, setExpectedSha256 } =
    useLitertLmConfig();
  const [status, setStatus] = useState<ModelStatus | null>(null);
  const [progress, setProgress] = useState<{ bytes: number; total: number } | null>(null);
  const [busy, setBusy] = useState<'download' | 'delete' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const plugin = getLiteRtLmPlugin();
  const native = Capacitor.isNativePlatform();

  useEffect(() => {
    if (!plugin) return;
    let cancelled = false;
    plugin.modelStatus().then((s) => {
      if (!cancelled) setStatus(s);
    });
    let handleRef: { remove: () => Promise<void> } | null = null;
    plugin
      .addListener('downloadProgress', (evt) => {
        setProgress({ bytes: evt.bytesDownloaded, total: evt.totalBytes });
      })
      .then((h) => {
        handleRef = h;
      });
    return () => {
      cancelled = true;
      void handleRef?.remove();
    };
  }, [plugin]);

  const isLocalFile = modelUrl.startsWith('file://');

  async function useLocalFile() {
    if (!plugin || !modelUrl) return;
    setError(null);
    try {
      await plugin.setModelConfig({ url: modelUrl });
      setStatus(await plugin.modelStatus());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function openAllFilesAccess() {
    if (!plugin) return;
    await plugin.requestAllFilesAccess();
    // Re-check status after user returns from Settings.
    setStatus(await plugin.modelStatus());
  }

  async function download() {
    if (!plugin || !modelUrl) return;
    setError(null);
    setBusy('download');
    try {
      await plugin.setModelConfig({
        url: modelUrl,
        expectedSha256: expectedSha256 || undefined,
      });
      await plugin.downloadModel();
      setStatus(await plugin.modelStatus());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
      setProgress(null);
    }
  }

  async function removeModel() {
    if (!plugin) return;
    setBusy('delete');
    try {
      await plugin.deleteModel();
      setStatus(await plugin.modelStatus());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="mb-5 pt-4 border-t border-amber-800/30">
      <label className="text-xs uppercase tracking-wider text-amber-400/70">
        On-device model (Gemma)
      </label>

      {!native && (
        <p className="text-xs text-amber-400/60 mt-2">
          Android-only. On web, LLM calls go to the cloud provider or the offline heuristic.
        </p>
      )}

      {native && !plugin && (
        <p className="text-xs text-rose-300/80 mt-2">
          Native plugin not registered. See <code>capacitor-plugins/litert-lm/README.md</code>.
        </p>
      )}

      <div className="mt-2 space-y-2">
        <div>
          <label className="text-[11px] text-amber-400/70">Model URL</label>
          <input
            type="url"
            placeholder="https://…/gemma-2b-it-cpu.task"
            value={modelUrl}
            onChange={(e) => setModelUrl(e.target.value)}
            className="mt-1 w-full rounded-md bg-amber-950/40 border border-amber-700/40 px-3 py-1.5 text-xs text-amber-100 placeholder:text-amber-500/40 focus:outline-none focus:border-amber-500"
          />
        </div>
        <div>
          <label className="text-[11px] text-amber-400/70">
            Expected SHA-256 (optional but recommended)
          </label>
          <input
            type="text"
            placeholder="sha256 hex"
            value={expectedSha256}
            onChange={(e) => setExpectedSha256(e.target.value)}
            className="mt-1 w-full rounded-md bg-amber-950/40 border border-amber-700/40 px-3 py-1.5 font-mono text-[11px] text-amber-100 placeholder:text-amber-500/40 focus:outline-none focus:border-amber-500"
          />
        </div>
      </div>

      <div className="mt-3 text-xs text-amber-200/80 space-y-1">
        <div>
          Status:{' '}
          <span className="font-mono text-amber-300">
            {!plugin
              ? '—'
              : status?.ready
                ? 'ready'
                : status?.downloaded
                  ? 'downloaded'
                  : 'not downloaded'}
          </span>
          {status?.sizeBytes && (
            <span className="text-amber-400/60 ml-2">
              ({(status.sizeBytes / (1024 * 1024)).toFixed(1)} MB)
            </span>
          )}
        </div>
        {progress && progress.total > 0 && (
          <div className="text-emerald-300">
            Downloading {(progress.bytes / (1024 * 1024)).toFixed(1)} /{' '}
            {(progress.total / (1024 * 1024)).toFixed(1)} MB (
            {Math.round((progress.bytes / progress.total) * 100)}%)
          </div>
        )}
        {error && <div className="text-rose-300/80">Error: {error}</div>}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {isLocalFile ? (
          <>
            <button
              type="button"
              onClick={() => void useLocalFile()}
              disabled={!plugin || !modelUrl}
              className="rounded-md border border-amber-700/40 px-3 py-1.5 text-xs text-amber-200 hover:border-amber-500 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              Use local file
            </button>
            <button
              type="button"
              onClick={() => void openAllFilesAccess()}
              disabled={!plugin}
              className="rounded-md border border-amber-700/40 px-3 py-1.5 text-xs text-amber-200 hover:border-amber-500 disabled:opacity-50 transition"
            >
              Grant file access
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => void download()}
            disabled={!plugin || !modelUrl || busy !== null}
            className="rounded-md border border-amber-700/40 px-3 py-1.5 text-xs text-amber-200 hover:border-amber-500 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {busy === 'download' ? 'Downloading…' : 'Download model'}
          </button>
        )}
        {status?.downloaded && !isLocalFile && (
          <button
            type="button"
            onClick={() => void removeModel()}
            disabled={busy !== null}
            className="rounded-md border border-rose-500/40 px-3 py-1.5 text-xs text-rose-200 hover:bg-rose-500/10 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {busy === 'delete' ? 'Removing…' : 'Remove model'}
          </button>
        )}
      </div>
    </section>
  );
}

function DbSnapshotSection() {
  const { currentVersion, pendingVersion, lastCheckedAt, lastError, applySync } =
    useSnapshotStatus();
  const [checking, setChecking] = useState(false);
  const cfg = snapshotConfigFromEnv();

  async function checkNow() {
    if (!cfg) return;
    setChecking(true);
    try {
      const result = await checkAndInstallSnapshot(cfg, currentVersion);
      applySync(result);
    } finally {
      setChecking(false);
    }
  }

  return (
    <section className="mb-5 pt-4 border-t border-amber-800/30">
      <label className="text-xs uppercase tracking-wider text-amber-400/70">
        Recipe database
      </label>
      <div className="mt-2 text-xs text-amber-200/80 space-y-1">
        <div>
          Current version:{' '}
          <span className="font-mono text-amber-300">{currentVersion ?? '—'}</span>
        </div>
        {pendingVersion && pendingVersion !== currentVersion && (
          <div className="text-emerald-300">
            New snapshot{' '}
            <span className="font-mono">{pendingVersion}</span> installed —
            reload the page to apply.
          </div>
        )}
        {lastCheckedAt && (
          <div className="text-amber-400/60">
            Last checked {new Date(lastCheckedAt).toLocaleString()}
          </div>
        )}
        {lastError && <div className="text-rose-300/80">Error: {lastError}</div>}
        {!cfg && (
          <div className="text-amber-400/60">
            Remote sync disabled — set <code>VITE_SNAPSHOT_URL</code> at build time.
          </div>
        )}
      </div>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => void checkNow()}
          disabled={!cfg || checking}
          className="rounded-md border border-amber-700/40 px-3 py-1.5 text-xs text-amber-200 hover:border-amber-500 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {checking ? 'Checking…' : 'Check for updates'}
        </button>
        {pendingVersion && pendingVersion !== currentVersion && (
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-md bg-emerald-500/20 border border-emerald-500/40 px-3 py-1.5 text-xs text-emerald-200 hover:bg-emerald-500/30 transition"
          >
            Reload to apply
          </button>
        )}
      </div>
    </section>
  );
}
