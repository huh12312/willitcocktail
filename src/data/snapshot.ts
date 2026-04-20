// Client-side DB snapshot sync. On cold start the app asks the publisher
// endpoint for its current db-version.json; if newer than what we have
// cached locally we download the .db, verify its sha256, and stash it in
// IndexedDB for the next load. The bundled cocktails.db is always the
// zero-config fallback.
//
// Design choices worth remembering:
//  - We *install* snapshots, not hot-swap. Swapping sql.js' in-memory DB
//    while React components hold references to the DataIndex would be a
//    landmine. Next cold start gets the new data — the UI just shows an
//    "update installed, reload to apply" chip.
//  - We verify sha256 before committing the snapshot to IDB. A corrupted
//    download must never overwrite a working snapshot.
//  - Native (Capacitor) intentionally opts out for V1. Updating the
//    app-bundled SQLite asset from native code requires the plugin's
//    copy-to-database dance, which is out of scope until a user asks.

export interface SnapshotManifest {
  version: string;
  sha256: string;
  size: number;
  builtAt: string;
}

export interface InstalledSnapshot {
  version: string;
  sha256: string;
  bytes: Uint8Array;
  installedAt: string;
}

const DB_NAME = 'willitcocktail-snapshot';
const STORE = 'snapshot';
const KEY = 'current';

function openIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('idb open failed'));
  });
}

export async function readInstalledSnapshot(): Promise<InstalledSnapshot | null> {
  if (typeof indexedDB === 'undefined') return null;
  try {
    const db = await openIdb();
    return await new Promise<InstalledSnapshot | null>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(KEY);
      req.onsuccess = () => resolve((req.result as InstalledSnapshot | undefined) ?? null);
      req.onerror = () => reject(req.error ?? new Error('idb read failed'));
    });
  } catch {
    return null;
  }
}

async function writeInstalledSnapshot(snap: InstalledSnapshot): Promise<void> {
  const db = await openIdb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(snap, KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('idb write failed'));
  });
}

export async function clearInstalledSnapshot(): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  const db = await openIdb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('idb delete failed'));
  });
}

export function compareVersions(a: string, b: string): number {
  // Pipeline emits unix-seconds timestamps. Numeric compare is correct; string
  // fallback lets future schemes (semver, dated tags) still order consistently.
  const ai = Number(a);
  const bi = Number(b);
  if (Number.isFinite(ai) && Number.isFinite(bi)) return Math.sign(ai - bi);
  return a < b ? -1 : a > b ? 1 : 0;
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  // Copy into a fresh ArrayBuffer so SubtleCrypto's type (BufferSource) is
  // satisfied without a cast — Uint8Array's backing buffer is typed as
  // ArrayBufferLike, which includes SharedArrayBuffer.
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const buf = await crypto.subtle.digest('SHA-256', copy.buffer as ArrayBuffer);
  const arr = new Uint8Array(buf);
  let out = '';
  for (const b of arr) out += b.toString(16).padStart(2, '0');
  return out;
}

export interface SnapshotConfig {
  baseUrl: string; // directory URL; manifest is at `${baseUrl}/db-version.json`
  timeoutMs?: number;
}

export type SyncResult =
  | { status: 'disabled'; reason: string }
  | { status: 'up-to-date'; remote: SnapshotManifest; current: string | null }
  | { status: 'installed'; remote: SnapshotManifest; previous: string | null }
  | { status: 'error'; error: Error };

export async function checkAndInstallSnapshot(
  config: SnapshotConfig | null,
  localVersion: string | null,
): Promise<SyncResult> {
  if (!config || !config.baseUrl) {
    return { status: 'disabled', reason: 'VITE_SNAPSHOT_URL not configured' };
  }
  try {
    const manifestUrl = `${stripTrailingSlash(config.baseUrl)}/db-version.json`;
    const manifest = await fetchJson<SnapshotManifest>(manifestUrl, config.timeoutMs);
    if (!isManifestShape(manifest)) {
      throw new Error('remote manifest missing required fields');
    }

    if (localVersion && compareVersions(manifest.version, localVersion) <= 0) {
      return { status: 'up-to-date', remote: manifest, current: localVersion };
    }

    const dbUrl = `${stripTrailingSlash(config.baseUrl)}/cocktails.db`;
    const bytes = await fetchBytes(dbUrl, config.timeoutMs);
    if (bytes.length !== manifest.size) {
      throw new Error(
        `downloaded size ${bytes.length} != manifest size ${manifest.size}`,
      );
    }
    const actualHash = await sha256Hex(bytes);
    if (actualHash !== manifest.sha256) {
      throw new Error(
        `sha256 mismatch: got ${actualHash.slice(0, 12)}… expected ${manifest.sha256.slice(0, 12)}…`,
      );
    }

    await writeInstalledSnapshot({
      version: manifest.version,
      sha256: manifest.sha256,
      bytes,
      installedAt: new Date().toISOString(),
    });
    return { status: 'installed', remote: manifest, previous: localVersion };
  } catch (err) {
    return {
      status: 'error',
      error: err instanceof Error ? err : new Error(String(err)),
    };
  }
}

function stripTrailingSlash(s: string): string {
  return s.replace(/\/+$/, '');
}

function isManifestShape(x: unknown): x is SnapshotManifest {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.version === 'string' &&
    typeof o.sha256 === 'string' &&
    typeof o.size === 'number' &&
    typeof o.builtAt === 'string'
  );
}

async function fetchJson<T>(url: string, timeoutMs = 10_000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, cache: 'no-store' });
    if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchBytes(url: string, timeoutMs = 30_000): Promise<Uint8Array> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, cache: 'no-store' });
    if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
    const buf = await res.arrayBuffer();
    return new Uint8Array(buf);
  } finally {
    clearTimeout(timer);
  }
}

export function snapshotConfigFromEnv(): SnapshotConfig | null {
  const url = import.meta.env.VITE_SNAPSHOT_URL as string | undefined;
  if (!url || typeof url !== 'string') return null;
  return { baseUrl: url };
}
