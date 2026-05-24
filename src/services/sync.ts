import { getDatabase } from './database';
import { supabase } from './supabase';
import { useSyncStore } from '../stores/syncStore';
import * as FileSystem from 'expo-file-system';
import * as Network from 'expo-network';
import type { SyncQueueItem } from '../types/database';

class SyncManager {
  // Exponential backoff schedule for failed sync items: 1, 2, 4, 8, 16 minutes.
  // After MAX_RETRIES attempts the item moves to 'failed' (terminal),
  // visible in stats so a human can investigate. Public so tests can read.
  static readonly MAX_RETRIES = 5;
  static readonly BACKOFF_MINUTES = [1, 2, 4, 8, 16];

  static computeNextRetryAt(retryCount: number, now: Date = new Date()): string {
    // retryCount has just been incremented (1..MAX_RETRIES). Index 0 of
    // BACKOFF_MINUTES is the wait *before* attempt #2 (i.e. after the 1st failure).
    const idx = Math.min(retryCount - 1, SyncManager.BACKOFF_MINUTES.length - 1);
    const delayMs = SyncManager.BACKOFF_MINUTES[idx] * 60 * 1000;
    return new Date(now.getTime() + delayMs).toISOString();
  }

  private syncInterval: ReturnType<typeof setInterval> | null = null;
  private networkSubscription: (() => void) | null = null;

  async startAutoSync(): Promise<void> {
    // Check network and sync periodically
    this.syncInterval = setInterval(async () => {
      const networkState = await Network.getNetworkStateAsync();
      const isOnline = networkState.isConnected && networkState.isInternetReachable;
      useSyncStore.getState().setOnline(isOnline ?? false);

      if (isOnline) {
        const stats = await this.getStats();
        if (stats.pending > 0) {
          await this.startSync();
        }
      }
    }, 30000);
  }

  stopAutoSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  async startSync(): Promise<void> {
    const store = useSyncStore.getState();
    if (store.isSyncing) return;

    store.setSyncing(true);
    store.clearErrors();

    try {
      const db = await getDatabase();
      // First, re-arm any 'error' items whose backoff window has expired.
      // Cheaper than running a separate cron — we only check at sync time.
      const nowIso = new Date().toISOString();
      await db.runAsync(
        `UPDATE sync_queue
            SET status = 'pending'
          WHERE status = 'error'
            AND retry_count < ?
            AND (next_retry_at IS NULL OR next_retry_at <= ?)`,
        [SyncManager.MAX_RETRIES, nowIso],
      );

      const pendingItems = await db.getAllAsync<SyncQueueItem>(
        `SELECT * FROM sync_queue WHERE status = 'pending' ORDER BY created_at ASC`
      );

      for (const item of pendingItems) {
        await this.syncItem(item);
      }

      const stats = await this.getStats();
      store.updateStats(stats);
      store.setLastSyncAt(new Date().toISOString());
    } catch (error) {
      store.addError(error instanceof Error ? error.message : 'Erreur de synchronisation');
    } finally {
      store.setSyncing(false);
    }
  }

  private async syncItem(item: SyncQueueItem): Promise<void> {
    const db = await getDatabase();
    try {
      const data = JSON.parse(item.data);

      // Upload photos if any
      if (item.photo_paths) {
        const paths = JSON.parse(item.photo_paths) as string[];
        for (const localPath of paths) {
          await this.uploadPhoto(localPath);
        }
      }

      switch (item.operation) {
        case 'INSERT': {
          const { error } = await supabase.from(item.table_name).insert(data);
          if (error) throw error;
          break;
        }
        case 'UPDATE': {
          const { error } = await supabase.from(item.table_name).update(data).eq('id', item.record_id);
          if (error) throw error;
          break;
        }
        case 'DELETE': {
          const { error } = await supabase.from(item.table_name).delete().eq('id', item.record_id);
          if (error) throw error;
          break;
        }
      }

      await db.runAsync(
        `UPDATE sync_queue SET status = 'synced', synced_at = datetime('now') WHERE id = ?`,
        [item.id]
      );

      // Update synced_at on the original record
      if (item.operation !== 'DELETE') {
        await db.runAsync(
          `UPDATE ${item.table_name} SET synced_at = datetime('now') WHERE id = ?`,
          [item.record_id]
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      const newRetryCount = item.retry_count + 1;
      // Once we've exhausted the retry budget, lock the item in 'failed'
      // so it stops cluttering the auto-sync loop. 'failed' rows are
      // surfaced in stats but require a manual action (or app update) to
      // be re-queued — see SyncManager.requeueFailed.
      if (newRetryCount >= SyncManager.MAX_RETRIES) {
        await db.runAsync(
          `UPDATE sync_queue
              SET status = 'failed',
                  error_message = ?,
                  retry_count = ?,
                  next_retry_at = NULL
            WHERE id = ?`,
          [message, newRetryCount, item.id],
        );
      } else {
        const nextRetryAt = SyncManager.computeNextRetryAt(newRetryCount);
        await db.runAsync(
          `UPDATE sync_queue
              SET status = 'error',
                  error_message = ?,
                  retry_count = ?,
                  next_retry_at = ?
            WHERE id = ?`,
          [message, newRetryCount, nextRetryAt, item.id],
        );
      }
    }
  }

  /**
   * Reset every 'failed' (terminal) item back to 'pending' for one more
   * attempt cycle. Use from a "Réessayer maintenant" button in the UI
   * after a manual fix (credentials updated, supplier reachable again…).
   */
  async requeueFailed(): Promise<number> {
    const db = await getDatabase();
    const result = await db.runAsync(
      `UPDATE sync_queue
          SET status = 'pending', retry_count = 0, next_retry_at = NULL
        WHERE status = 'failed'`,
    );
    return result.changes ?? 0;
  }

  async uploadPhoto(localPath: string): Promise<string | null> {
    try {
      const fileInfo = await FileSystem.getInfoAsync(localPath);
      if (!fileInfo.exists) return null;

      const fileName = `${Date.now()}_${localPath.split('/').pop()}`;
      const filePath = `photos/${fileName}`;

      const base64 = await FileSystem.readAsStringAsync(localPath, {
        encoding: 'base64',
      });

      const { error } = await supabase.storage
        .from('haccp-photos')
        .upload(filePath, decode(base64), { contentType: 'image/jpeg' });

      if (error) throw error;
      return filePath;
    } catch {
      return null;
    }
  }

  async getStats(): Promise<{ pending: number; synced: number; error: number; failed: number; total: number }> {
    const db = await getDatabase();
    const result = await db.getAllAsync<{ status: string; count: number }>(
      `SELECT status, COUNT(*) as count FROM sync_queue GROUP BY status`
    );

    const stats = { pending: 0, synced: 0, error: 0, failed: 0, total: 0 };
    for (const row of result) {
      if (row.status === 'pending') stats.pending = row.count;
      else if (row.status === 'synced') stats.synced = row.count;
      else if (row.status === 'error') stats.error = row.count;
      else if (row.status === 'failed') stats.failed = row.count;
    }
    stats.total = stats.pending + stats.synced + stats.error + stats.failed;
    return stats;
  }
}

function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export const syncManager = new SyncManager();
