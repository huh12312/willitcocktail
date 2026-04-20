import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  checkAndInstallSnapshot,
  compareVersions,
  clearInstalledSnapshot,
  readInstalledSnapshot,
  type SnapshotManifest,
} from './snapshot';

describe('compareVersions', () => {
  it('orders unix timestamps numerically', () => {
    expect(compareVersions('1700000000', '1700000001')).toBeLessThan(0);
    expect(compareVersions('1700000001', '1700000000')).toBeGreaterThan(0);
    expect(compareVersions('1700000000', '1700000000')).toBe(0);
  });

  it('falls back to string compare for non-numeric versions', () => {
    expect(compareVersions('2026-04-01', '2026-04-02')).toBeLessThan(0);
    expect(compareVersions('v2', 'v10')).toBeGreaterThan(0); // lexicographic fallback
  });
});

describe('checkAndInstallSnapshot', () => {
  beforeEach(async () => {
    await clearInstalledSnapshot();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('is disabled when no config is provided', async () => {
    const result = await checkAndInstallSnapshot(null, '1700000000');
    expect(result.status).toBe('disabled');
  });

  it('reports up-to-date when remote version matches local', async () => {
    const manifest: SnapshotManifest = {
      version: '1700000000',
      sha256: 'deadbeef',
      size: 10,
      builtAt: '2026-01-01T00:00:00Z',
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(manifest)),
    );
    const result = await checkAndInstallSnapshot(
      { baseUrl: 'https://example.com' },
      '1700000000',
    );
    expect(result.status).toBe('up-to-date');
  });

  it('rejects a download whose hash does not match the manifest', async () => {
    const bytes = new Uint8Array([1, 2, 3, 4, 5]);
    const manifest: SnapshotManifest = {
      version: '1800000000',
      sha256: '0'.repeat(64), // wrong on purpose
      size: bytes.length,
      builtAt: '2026-01-01T00:00:00Z',
    };
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith('db-version.json')) return jsonResponse(manifest);
      return bytesResponse(bytes);
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await checkAndInstallSnapshot(
      { baseUrl: 'https://example.com' },
      '1700000000',
    );
    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.error.message).toMatch(/sha256/i);
    }
    // A failed install must leave nothing behind.
    expect(await readInstalledSnapshot()).toBeNull();
  });

  it('installs a valid snapshot and readback returns the bytes', async () => {
    const bytes = new Uint8Array([9, 8, 7, 6, 5, 4, 3, 2, 1]);
    const sha = await sha256Hex(bytes);
    const manifest: SnapshotManifest = {
      version: '1800000000',
      sha256: sha,
      size: bytes.length,
      builtAt: '2026-01-01T00:00:00Z',
    };
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith('db-version.json')) return jsonResponse(manifest);
      return bytesResponse(bytes);
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await checkAndInstallSnapshot(
      { baseUrl: 'https://example.com/' }, // trailing slash should be handled
      '1700000000',
    );
    expect(result.status).toBe('installed');

    const installed = await readInstalledSnapshot();
    expect(installed).not.toBeNull();
    expect(installed?.version).toBe('1800000000');
    expect(Array.from(installed!.bytes)).toEqual(Array.from(bytes));
  });
});

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function bytesResponse(bytes: Uint8Array): Response {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new Response(copy.buffer as ArrayBuffer, {
    status: 200,
    headers: { 'content-type': 'application/octet-stream' },
  });
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const buf = await crypto.subtle.digest('SHA-256', copy.buffer as ArrayBuffer);
  const arr = new Uint8Array(buf);
  let out = '';
  for (const b of arr) out += b.toString(16).padStart(2, '0');
  return out;
}
