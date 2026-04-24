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
  const [onDeviceActive, setOnDeviceActive] = useState(false);

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

        <OnDeviceModelSection onActiveChange={setOnDeviceActive} />

        <DbSnapshotSection />

        <div className="flex items-center justify-between pt-3 border-t border-amber-800/30">
          <div className="text-xs">
            {choice === 'heuristic' ? (
              <span className="text-amber-400/70">Offline heuristic selected.</span>
            ) : choice === 'litert-lm' ? (
              <span className="text-amber-400/70">On-device forced — falls back to heuristic if not ready.</span>
            ) : choice === 'cloud' ? (
              configured
                ? <span className="text-emerald-400">Cloud configured.</span>
                : <span className="text-rose-300/80">Cloud not configured — falling back to heuristic.</span>
            ) : (
              // auto: reflect actual active backend (AICore, downloaded, or copied)
              onDeviceActive
                ? <span className="text-emerald-400">On-device model active.</span>
                : configured
                  ? <span className="text-emerald-400">Cloud configured.</span>
                  : <span className="text-amber-400/70">No model configured — using offline heuristic.</span>
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

function OnDeviceModelSection({ onActiveChange }: { onActiveChange?: (active: boolean) => void }) {
  const { modelUrl, expectedSha256, setModelUrl, setExpectedSha256 } =
    useLitertLmConfig();
  const [status, setStatus] = useState<ModelStatus | null>(null);
  const [aiCoreStatus, setAiCoreStatus] = useState<import('../llm/litert-lm').AiCoreStatusResult | null>(null);
  const [progress, setProgress] = useState<{ bytes: number; total: number } | null>(null);
  const [busy, setBusy] = useState<'download' | 'import' | 'delete' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'download' | 'import' | 'device'>('download');
  const [deviceModels, setDeviceModels] = useState<import('../llm/litert-lm').DeviceModel[]>([]);
  const plugin = getLiteRtLmPlugin();
  const native = Capacitor.isNativePlatform();

  // Report combined active state to parent whenever either status changes.
  useEffect(() => {
    const active = aiCoreStatus?.status === 'available' || status?.downloaded === true;
    onActiveChange?.(active);
  }, [aiCoreStatus, status, onActiveChange]);

  useEffect(() => {
    if (!plugin) return;
    let cancelled = false;
    plugin.modelStatus().then((s) => { if (!cancelled) setStatus(s); });
    plugin.aiCoreStatus().then((s) => { if (!cancelled) setAiCoreStatus(s); });
    plugin.detectDeviceModels().then((r) => { if (!cancelled) setDeviceModels(r.models); });
    const listeners: Promise<{ remove: () => Promise<void> }>[] = [
      plugin.addListener('downloadProgress', (evt) => {
        setProgress({ bytes: evt.bytesDownloaded, total: evt.totalBytes });
      }),
      plugin.addListener('importProgress', (evt) => {
        setProgress({ bytes: evt.bytesWritten, total: evt.totalBytes });
      }),
    ];
    return () => {
      cancelled = true;
      listeners.forEach((p) => p.then((h) => h.remove()));
    };
  }, [plugin]);

  async function download() {
    if (!plugin || !modelUrl) return;
    setError(null);
    setBusy('download');
    try {
      await plugin.setModelConfig({ url: modelUrl, expectedSha256: expectedSha256 || undefined });
      await plugin.downloadModel();
      setStatus(await plugin.modelStatus());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
      setProgress(null);
    }
  }

  async function importFromPath(path: string) {
    if (!plugin) return;
    setError(null);
    try {
      await plugin.importModelFromPath({ path });
      setStatus(await plugin.modelStatus());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setProgress(null);
    }
  }

  async function rescanDeviceModels() {
    if (!plugin) return;
    const r = await plugin.detectDeviceModels();
    setDeviceModels(r.models);
  }

  async function useDeviceModel(path: string) {
    if (!plugin) return;
    setError(null);
    try {
      await plugin.setModelConfig({ url: `file://${path}` });
      setStatus(await plugin.modelStatus());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
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

  const fmtMb = (b: number) => `${(b / (1024 * 1024)).toFixed(1)} MB`;

  return (
    <section className="mb-5 pt-4 border-t border-amber-800/30">
      <label className="text-xs uppercase tracking-wider text-amber-400/70">
        On-device model (Gemma)
      </label>

      {/* AICore status — only meaningful on native Android */}
      {native && (
        <div className="mt-2 mb-3 flex items-center gap-2">
          {aiCoreStatus === null ? (
            <span className="text-xs text-amber-400/40 animate-pulse">Checking system model…</span>
          ) : aiCoreStatus.status === 'available' ? (
            <span className="text-xs rounded-full px-2.5 py-0.5 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300">
              System model (AICore) ✓ — no download needed
            </span>
          ) : aiCoreStatus.status === 'downloading' ? (
            <span className="text-xs rounded-full px-2.5 py-0.5 bg-sky-500/20 border border-sky-500/40 text-sky-300">
              AICore model downloading…
            </span>
          ) : aiCoreStatus.status === 'downloadable' ? (
            <span className="text-xs text-amber-300/70">
              System model available to download (AICore)
            </span>
          ) : (
            <span className="text-xs text-amber-400/40">
              System model unavailable — Pixel 9+ required
            </span>
          )}
        </div>
      )}

      {!native && (
        <p className="text-xs text-amber-400/60 mt-2">
          Android-only. On web, LLM calls use the cloud provider or offline heuristic.
        </p>
      )}

      {native && !plugin && (
        <p className="text-xs text-rose-300/80 mt-2">
          Native plugin not registered.
        </p>
      )}

      {native && plugin && (
        <>
          {/* Status bar */}
          <div className="mt-2 text-xs text-amber-200/80 space-y-1">
            <div>
              Status:{' '}
              <span className="font-mono text-amber-300">
                {status?.ready ? 'ready' : status?.downloaded ? 'downloaded' : 'not downloaded'}
              </span>
              {status?.backend && (
                <span className="ml-2 text-[10px] uppercase tracking-wider rounded px-1.5 py-0.5 border bg-amber-900/40 border-amber-700/40 text-amber-300/70">
                  {status.backend}
                </span>
              )}
              {status?.sizeBytes != null && (
                <span className="text-amber-400/60 ml-2">({fmtMb(status.sizeBytes)})</span>
              )}
            </div>
            {progress && progress.total > 0 && (
              <div className="text-emerald-300">
                {busy === 'import' ? 'Copying' : 'Downloading'}{' '}
                {fmtMb(progress.bytes)} / {fmtMb(progress.total)}{' '}
                ({Math.round((progress.bytes / progress.total) * 100)}%)
              </div>
            )}
            {error && <div className="text-rose-300/80">Error: {error}</div>}
          </div>

          {/* Tab switcher */}
          <div className="mt-3 flex gap-1 bg-amber-900/30 rounded-md p-0.5 text-xs">
            {(['download', 'import', 'device'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={[
                  'flex-1 py-1 rounded transition',
                  tab === t
                    ? 'bg-amber-500 text-amber-950 font-medium'
                    : 'text-amber-300/70 hover:text-amber-200',
                ].join(' ')}
              >
                {t === 'download' ? 'Download' : t === 'import' ? 'Import file' : 'On device'}
              </button>
            ))}
          </div>

          {/* Download tab */}
          {tab === 'download' && (
            <div className="mt-3 space-y-2">
              <div>
                <label className="text-[11px] text-amber-400/70">Model URL</label>
                <input
                  type="url"
                  placeholder="https://…/model.litertlm"
                  value={modelUrl.startsWith('file://') ? '' : modelUrl}
                  onChange={(e) => setModelUrl(e.target.value)}
                  className="mt-1 w-full rounded-md bg-amber-950/40 border border-amber-700/40 px-3 py-1.5 text-xs text-amber-100 placeholder:text-amber-500/40 focus:outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label className="text-[11px] text-amber-400/70">SHA-256 (optional)</label>
                <input
                  type="text"
                  placeholder="sha256 hex"
                  value={expectedSha256}
                  onChange={(e) => setExpectedSha256(e.target.value)}
                  className="mt-1 w-full rounded-md bg-amber-950/40 border border-amber-700/40 px-3 py-1.5 font-mono text-[11px] text-amber-100 placeholder:text-amber-500/40 focus:outline-none focus:border-amber-500"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void download()}
                  disabled={!modelUrl || modelUrl.startsWith('file://') || busy !== null}
                  className="rounded-md border border-amber-700/40 px-3 py-1.5 text-xs text-amber-200 hover:border-amber-500 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  {busy === 'download' ? 'Downloading…' : 'Download'}
                </button>
                {status?.downloaded && (
                  <button
                    type="button"
                    onClick={() => void removeModel()}
                    disabled={busy !== null}
                    className="rounded-md border border-rose-500/40 px-3 py-1.5 text-xs text-rose-200 hover:bg-rose-500/10 disabled:opacity-50 transition"
                  >
                    {busy === 'delete' ? 'Removing…' : 'Remove'}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Import tab — scans Downloads for .litertlm files and copies to internal storage */}
          {tab === 'import' && (() => {
            const downloadModels = deviceModels.filter((m) => m.name.startsWith('Downloads'));
            return (
              <div className="mt-3 space-y-2">
                <p className="text-xs text-amber-400/60">
                  Download a <code>.litertlm</code> model to your Downloads folder, then tap Copy to install it.
                </p>
                {downloadModels.length === 0 ? (
                  <div className="space-y-2">
                    <p className="text-xs text-amber-500/60">No .litertlm files found in Downloads. Requires All Files Access permission.</p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => void plugin!.requestAllFilesAccess().then(() => rescanDeviceModels())}
                        className="rounded-md border border-amber-700/40 px-3 py-1.5 text-xs text-amber-200 hover:border-amber-500 transition"
                      >
                        Grant file access
                      </button>
                      <button
                        type="button"
                        onClick={() => void rescanDeviceModels()}
                        className="rounded-md border border-amber-700/40 px-3 py-1.5 text-xs text-amber-200 hover:border-amber-500 transition"
                      >
                        Scan again
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {downloadModels.map((m) => (
                      <div key={m.path} className="flex items-center justify-between gap-2 rounded-md border border-amber-700/40 px-3 py-2">
                        <div>
                          <div className="text-xs text-amber-100">{m.name.replace('Downloads: ', '')}</div>
                          <div className="text-[10px] text-amber-400/60">{fmtMb(m.sizeBytes)}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => void importFromPath(m.path)}
                          disabled={progress !== null}
                          className="shrink-0 rounded-md border border-amber-700/40 px-3 py-1 text-xs text-amber-200 hover:border-amber-500 disabled:opacity-50 transition"
                        >
                          {progress !== null ? 'Copying…' : 'Copy'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}

          {/* On-device tab (AI Edge Gallery / Pixel) */}
          {tab === 'device' && (
            <div className="mt-3 space-y-2">
              {deviceModels.length === 0 ? (
                <div className="space-y-2">
                  <p className="text-xs text-amber-400/60">
                    No models detected. Requires All Files Access permission and AI Edge Gallery (or similar) installed.
                  </p>
                  <button
                    type="button"
                    onClick={() => void plugin.requestAllFilesAccess().then(() =>
                      plugin.detectDeviceModels().then((r) => setDeviceModels(r.models))
                    )}
                    className="rounded-md border border-amber-700/40 px-3 py-1.5 text-xs text-amber-200 hover:border-amber-500 transition"
                  >
                    Grant file access &amp; scan
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-amber-400/60">
                    Found {deviceModels.length} model{deviceModels.length !== 1 ? 's' : ''} — uses the file directly with no copy.
                  </p>
                  {deviceModels.map((m) => (
                    <div key={m.path} className="flex items-center justify-between gap-2 rounded-md border border-amber-700/40 px-3 py-2">
                      <div>
                        <div className="text-xs text-amber-100">{m.name}</div>
                        <div className="text-[10px] text-amber-400/60">{fmtMb(m.sizeBytes)}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => void useDeviceModel(m.path)}
                        disabled={busy !== null}
                        className="shrink-0 rounded-md border border-amber-700/40 px-3 py-1 text-xs text-amber-200 hover:border-amber-500 disabled:opacity-50 transition"
                      >
                        Use
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}

function DbSnapshotSection() {
  const { currentVersion, pendingVersion, lastCheckedAt, lastError, applySync } =
    useSnapshotStatus();
  const [checking, setChecking] = useState(false);
  const cfg = snapshotConfigFromEnv();
  const native = Capacitor.isNativePlatform();

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
        {native ? (
          <div className="text-amber-400/60">
            Database is bundled with the app — updates arrive via app install.
          </div>
        ) : (
          <>
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
          </>
        )}
      </div>
      {!native && (
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
      )}
    </section>
  );
}
