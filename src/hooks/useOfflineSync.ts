import { useEffect } from 'react';
import * as Network from 'expo-network';
import { useSyncStore } from '../stores/syncStore';
import { syncManager } from '../services/sync';

export function useOfflineSync() {
  const { isOnline, pendingCount, lastSyncAt, isSyncing } = useSyncStore();

  useEffect(() => {
    // Initial network check
    const checkNetwork = async () => {
      const state = await Network.getNetworkStateAsync();
      const online = state.isConnected && state.isInternetReachable;
      useSyncStore.getState().setOnline(online ?? false);
    };
    checkNetwork();

    // Start auto sync
    syncManager.startAutoSync();

    return () => {
      syncManager.stopAutoSync();
    };
  }, []);

  const triggerSync = async () => {
    await syncManager.startSync();
  };

  return { isOnline, pendingCount, lastSyncAt, isSyncing, triggerSync };
}
