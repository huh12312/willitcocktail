import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SnapshotManifest, SyncResult } from '../data/snapshot';

interface SnapshotStatusState {
  // What the DB we're currently using calls itself. `null` until we've
  // introspected the bundled or installed snapshot once on cold start.
  currentVersion: string | null;
  // Present iff an install completed this session — the UI uses it to
  // prompt a reload since the new DB kicks in on next cold start.
  pendingVersion: string | null;
  lastCheckedAt: string | null;
  lastRemote: SnapshotManifest | null;
  lastError: string | null;
  setCurrent: (v: string | null) => void;
  clearPending: () => void;
  applySync: (r: SyncResult) => void;
}

export const useSnapshotStatus = create<SnapshotStatusState>()(
  persist(
    (set) => ({
      currentVersion: null,
      pendingVersion: null,
      lastCheckedAt: null,
      lastRemote: null,
      lastError: null,
      setCurrent: (v) => set({ currentVersion: v }),
      clearPending: () => set({ pendingVersion: null }),
      applySync: (r) => {
        const at = new Date().toISOString();
        if (r.status === 'installed') {
          set({
            pendingVersion: r.remote.version,
            lastRemote: r.remote,
            lastCheckedAt: at,
            lastError: null,
          });
        } else if (r.status === 'up-to-date') {
          set({
            lastRemote: r.remote,
            lastCheckedAt: at,
            lastError: null,
          });
        } else if (r.status === 'error') {
          set({ lastCheckedAt: at, lastError: r.error.message });
        }
      },
    }),
    {
      name: 'willitcocktail-snapshot-status',
      partialize: (s) => ({
        pendingVersion: s.pendingVersion,
        lastCheckedAt: s.lastCheckedAt,
        lastRemote: s.lastRemote,
      }),
    },
  ),
);
