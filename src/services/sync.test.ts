/**
 * Unit tests for the sync retry/backoff logic added in mission 4a.
 * We focus on the pure helper `SyncManager.computeNextRetryAt` and on
 * the SQL state-machine: a failed item bumps retry_count, gets a
 * next_retry_at in the future, stays in 'error' until MAX_RETRIES,
 * then locks in 'failed'.
 */
/* eslint-disable import/first */
jest.mock('./supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      insert: jest.fn(() => ({ error: new Error('network down') })),
      update: jest.fn(() => ({ error: new Error('network down') })),
      delete: jest.fn(() => ({ error: new Error('network down') })),
    })),
  },
  isDemoMode: false,
}));

// In-memory fake DB just rich enough to model sync_queue rows.
// Prefix-named `mock*` so Jest's jest.mock() factory whitelist accepts it.
const mockFakeRows = new Map<string, Record<string, unknown>>();
const fakeRows = mockFakeRows;
const mockFakeDb = {
  getAllAsync: jest.fn(async (sql: string) => {
    if (sql.includes("status = 'pending'")) {
      return Array.from(fakeRows.values()).filter((r) => r.status === 'pending');
    }
    return [];
  }),
  getFirstAsync: jest.fn(),
  runAsync: jest.fn(async (sql: string, params: unknown[] = []) => {
    if (sql.startsWith('UPDATE sync_queue SET status = \'synced\'')) {
      const id = params[0] as string;
      const row = fakeRows.get(id);
      if (row) row.status = 'synced';
      return { changes: 1 };
    }
    if (sql.includes("SET status = 'failed'")) {
      const [message, retry, id] = params as [string, number, string];
      const row = fakeRows.get(id);
      if (row) {
        row.status = 'failed';
        row.error_message = message;
        row.retry_count = retry;
        row.next_retry_at = null;
      }
      return { changes: 1 };
    }
    if (sql.includes("SET status = 'error'")) {
      const [message, retry, next, id] = params as [string, number, string, string];
      const row = fakeRows.get(id);
      if (row) {
        row.status = 'error';
        row.error_message = message;
        row.retry_count = retry;
        row.next_retry_at = next;
      }
      return { changes: 1 };
    }
    if (sql.startsWith('UPDATE sync_queue\n            SET status = \'pending\'')) {
      // Re-arm clause from startSync
      const [max, nowIso] = params as [number, string];
      let changes = 0;
      for (const row of fakeRows.values()) {
        if (
          row.status === 'error' &&
          (row.retry_count as number) < max &&
          (!row.next_retry_at || (row.next_retry_at as string) <= nowIso)
        ) {
          row.status = 'pending';
          changes++;
        }
      }
      return { changes };
    }
    return { changes: 0 };
  }),
  execAsync: jest.fn(),
};

jest.mock('./database', () => ({
  getDatabase: jest.fn(() => Promise.resolve(mockFakeDb)),
}));

import { syncManager } from './sync';

const SyncManagerClass = syncManager.constructor as unknown as {
  MAX_RETRIES: number;
  BACKOFF_MINUTES: number[];
  computeNextRetryAt: (n: number, now?: Date) => string;
};

function seedRow(id: string, overrides: Partial<Record<string, unknown>> = {}) {
  fakeRows.set(id, {
    id,
    table_name: 'temperature_readings',
    record_id: 'rec-' + id,
    operation: 'INSERT',
    data: '{}',
    photo_paths: null,
    status: 'pending',
    retry_count: 0,
    next_retry_at: null,
    error_message: null,
    ...overrides,
  });
}

describe('SyncManager.computeNextRetryAt', () => {
  it('schedules 1 minute after the first failure', () => {
    const now = new Date('2026-05-24T10:00:00.000Z');
    const next = SyncManagerClass.computeNextRetryAt(1, now);
    expect(next).toBe('2026-05-24T10:01:00.000Z');
  });

  it('doubles each retry: 1, 2, 4, 8, 16', () => {
    const now = new Date('2026-05-24T10:00:00.000Z');
    const minutes = [1, 2, 3, 4, 5].map((n) => {
      const next = new Date(SyncManagerClass.computeNextRetryAt(n, now)).getTime();
      return (next - now.getTime()) / 60000;
    });
    expect(minutes).toEqual([1, 2, 4, 8, 16]);
  });

  it('caps at the longest backoff for over-large retry counts', () => {
    const now = new Date('2026-05-24T10:00:00.000Z');
    const next = SyncManagerClass.computeNextRetryAt(99, now);
    expect(next).toBe('2026-05-24T10:16:00.000Z');
  });
});

describe('sync retry state machine', () => {
  beforeEach(() => {
    fakeRows.clear();
    jest.clearAllMocks();
  });

  it('first failure marks status=error, retry_count=1, next_retry_at in 1min', async () => {
    seedRow('sq-1');
    await syncManager.startSync();
    const row = fakeRows.get('sq-1')!;
    expect(row.status).toBe('error');
    expect(row.retry_count).toBe(1);
    expect(typeof row.next_retry_at).toBe('string');
    expect(new Date(row.next_retry_at as string).getTime()).toBeGreaterThan(Date.now());
  });

  it('after 4 retries the 5th failure pushes status=failed (terminal)', async () => {
    seedRow('sq-2', { status: 'pending', retry_count: 4 });
    await syncManager.startSync();
    const row = fakeRows.get('sq-2')!;
    expect(row.status).toBe('failed');
    expect(row.retry_count).toBe(5);
    expect(row.next_retry_at).toBeNull();
  });

  it('error items with elapsed next_retry_at get re-armed to pending on next sync', async () => {
    // Item has been waiting; its next_retry_at is in the past.
    const past = new Date(Date.now() - 60_000).toISOString();
    seedRow('sq-3', { status: 'error', retry_count: 2, next_retry_at: past });
    await syncManager.startSync();
    const row = fakeRows.get('sq-3')!;
    // Re-armed then immediately re-failed in the same loop → ends in 'error' again
    // with bumped retry_count.
    expect(row.status).toBe('error');
    expect(row.retry_count).toBe(3);
  });

  it('error items still in their cooldown window are not retried', async () => {
    const future = new Date(Date.now() + 5 * 60_000).toISOString();
    seedRow('sq-4', { status: 'error', retry_count: 1, next_retry_at: future });
    await syncManager.startSync();
    const row = fakeRows.get('sq-4')!;
    expect(row.status).toBe('error');
    expect(row.retry_count).toBe(1); // untouched
  });
});
