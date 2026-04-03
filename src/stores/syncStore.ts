import { create } from 'zustand';

interface SyncError {
  id: string;
  message: string;
  occurredAt: string;
}

interface SyncStats {
  pending: number;
  synced: number;
  error: number;
  total: number;
}

interface SyncState {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncAt: string | null;
  errors: SyncError[];
  setOnline: (online: boolean) => void;
  setSyncing: (syncing: boolean) => void;
  clearErrors: () => void;
  addError: (message: string) => void;
  setLastSyncAt: (date: string) => void;
  updateStats: (stats: SyncStats) => void;
  setPendingCount: (count: number) => void;
}

export const useSyncStore = create<SyncState>((set) => ({
  isOnline: false,
  isSyncing: false,
  pendingCount: 0,
  lastSyncAt: null,
  errors: [],

  setOnline: (online: boolean) => set({ isOnline: online }),

  setSyncing: (syncing: boolean) => set({ isSyncing: syncing }),

  clearErrors: () => set({ errors: [] }),

  addError: (message: string) =>
    set((state) => ({
      errors: [
        ...state.errors,
        {
          id: `${Date.now()}-${Math.random()}`,
          message,
          occurredAt: new Date().toISOString(),
        },
      ],
    })),

  setLastSyncAt: (date: string) => set({ lastSyncAt: date }),

  updateStats: (stats: SyncStats) => set({ pendingCount: stats.pending }),

  setPendingCount: (count: number) => set({ pendingCount: count }),
}));
