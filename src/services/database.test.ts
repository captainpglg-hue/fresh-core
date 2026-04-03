const mockDb = {
  execAsync: jest.fn(),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getAllAsync: jest.fn(() => Promise.resolve([] as any[])),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getFirstAsync: jest.fn(() => Promise.resolve(null as any)),
  runAsync: jest.fn(() => Promise.resolve({ lastInsertRowId: 1, changes: 1 })),
};

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(() => Promise.resolve(mockDb)),
}));

jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(() => 'test-uuid-123'),
  digestStringAsync: jest.fn(),
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
}));

describe('database service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  it('initDatabase creates tables', async () => {
    const SQLite = require('expo-sqlite');
    const { initDatabase } = require('./database');
    await initDatabase();
    expect(SQLite.openDatabaseAsync).toHaveBeenCalledWith('freshcore.db');
    expect(mockDb.execAsync).toHaveBeenCalled();

    const sql = mockDb.execAsync.mock.calls[0][0];
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS profiles');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS establishments');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS equipment');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS temperature_readings');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS suppliers');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS deliveries');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS cleaning_tasks');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS cleaning_records');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS sync_queue');
    expect(sql).toContain('PRAGMA journal_mode = WAL');
    expect(sql).toContain('PRAGMA foreign_keys = ON');
  });

  it('insertLocal adds record to table and sync_queue', async () => {
    const { insertLocal } = require('./database');

    const id = await insertLocal('equipment', {
      name: 'Frigo 1',
      type: 'cold_positive',
      establishment_id: 'est-1',
    });

    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
    // Should have been called twice: once for the record, once for sync_queue
    expect(mockDb.runAsync).toHaveBeenCalledTimes(2);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const calls = mockDb.runAsync.mock.calls as any[][];
    const firstCallSql = calls[0][0];
    expect(firstCallSql).toContain('INSERT INTO equipment');

    const secondCallSql = calls[1][0];
    expect(secondCallSql).toContain('INSERT INTO sync_queue');
  });

  it('getAllLocal returns records from table', async () => {
    const mockRecords = [
      { id: '1', name: 'Frigo 1' },
      { id: '2', name: 'Frigo 2' },
    ];
    mockDb.getAllAsync.mockResolvedValueOnce(mockRecords);
    const { getAllLocal } = require('./database');

    const results = await getAllLocal('equipment');
    expect(results).toEqual(mockRecords);
    expect(mockDb.getAllAsync).toHaveBeenCalledWith(
      'SELECT * FROM equipment',
      []
    );
  });

  it('getAllLocal supports WHERE clause', async () => {
    mockDb.getAllAsync.mockResolvedValueOnce([{ id: '1', name: 'Frigo' }]);
    const { getAllLocal } = require('./database');

    const results = await getAllLocal('equipment', 'establishment_id = ?', ['est-1']);
    expect(results).toHaveLength(1);
    expect(mockDb.getAllAsync).toHaveBeenCalledWith(
      'SELECT * FROM equipment WHERE establishment_id = ?',
      ['est-1']
    );
  });

  it('getAllLocal returns empty array when no records', async () => {
    mockDb.getAllAsync.mockResolvedValueOnce([]);
    const { getAllLocal } = require('./database');

    const results = await getAllLocal('equipment');
    expect(results).toEqual([]);
  });

  it('getByIdLocal returns single record', async () => {
    mockDb.getFirstAsync.mockResolvedValueOnce({ id: '1', name: 'Frigo' });
    const { getByIdLocal } = require('./database');

    const result = await getByIdLocal('equipment', '1');
    expect(result).toEqual({ id: '1', name: 'Frigo' });
  });

  it('getByIdLocal returns null when not found', async () => {
    mockDb.getFirstAsync.mockResolvedValueOnce(null);
    const { getByIdLocal } = require('./database');

    const result = await getByIdLocal('equipment', 'nonexistent');
    expect(result).toBeNull();
  });

  it('deleteLocal removes from table and adds to sync_queue', async () => {
    const { deleteLocal } = require('./database');

    await deleteLocal('equipment', 'eq-1');
    expect(mockDb.runAsync).toHaveBeenCalledTimes(2);
  });
});
