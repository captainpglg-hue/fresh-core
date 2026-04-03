import * as SQLite from 'expo-sqlite';
import * as Crypto from 'expo-crypto';

let db: SQLite.SQLiteDatabase | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!db) {
    db = await SQLite.openDatabaseAsync('freshcore.db');
  }
  return db;
}

export async function initDatabase(): Promise<void> {
  const database = await getDatabase();

  await database.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'owner',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS establishments (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      name TEXT NOT NULL,
      address TEXT,
      city TEXT,
      postal_code TEXT,
      siret TEXT,
      establishment_type TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS equipment (
      id TEXT PRIMARY KEY,
      establishment_id TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      threshold_min REAL,
      threshold_max REAL,
      location TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS temperature_readings (
      id TEXT PRIMARY KEY,
      establishment_id TEXT NOT NULL,
      equipment_id TEXT NOT NULL,
      temperature_value REAL NOT NULL,
      threshold_min REAL,
      threshold_max REAL,
      is_compliant INTEGER NOT NULL,
      ocr_confidence REAL,
      manual_entry INTEGER DEFAULT 0,
      photo_path TEXT,
      reading_type TEXT NOT NULL DEFAULT 'routine',
      corrective_action TEXT,
      corrective_action_photo_path TEXT,
      recorded_by TEXT,
      recorded_at TEXT NOT NULL DEFAULT (datetime('now')),
      local_id TEXT UNIQUE,
      synced_at TEXT,
      blockchain_hash TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS suppliers (
      id TEXT PRIMARY KEY,
      establishment_id TEXT NOT NULL,
      name TEXT NOT NULL,
      siret TEXT,
      sanitary_approval TEXT,
      sanitary_approval_expiry TEXT,
      contact_email TEXT,
      contact_phone TEXT,
      address TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS deliveries (
      id TEXT PRIMARY KEY,
      establishment_id TEXT NOT NULL,
      supplier_id TEXT,
      delivery_date TEXT NOT NULL DEFAULT (date('now')),
      delivery_note_photo_path TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      refusal_reason TEXT,
      refusal_photo_path TEXT,
      recorded_by TEXT,
      recorded_at TEXT DEFAULT (datetime('now')),
      local_id TEXT UNIQUE,
      synced_at TEXT,
      blockchain_hash TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS delivery_items (
      id TEXT PRIMARY KEY,
      delivery_id TEXT NOT NULL,
      product_name TEXT NOT NULL,
      category TEXT,
      temperature REAL,
      temperature_compliant INTEGER,
      dlc TEXT,
      dlc_compliant INTEGER,
      lot_number TEXT,
      packaging_ok INTEGER DEFAULT 1,
      visual_ok INTEGER DEFAULT 1,
      photo_paths TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS cleaning_tasks (
      id TEXT PRIMARY KEY,
      establishment_id TEXT NOT NULL,
      zone TEXT NOT NULL,
      zone_name TEXT NOT NULL,
      frequency TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS cleaning_records (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      establishment_id TEXT NOT NULL,
      cleaning_product TEXT,
      dosage TEXT,
      contact_time_minutes INTEGER,
      photo_path TEXT,
      validated_by TEXT,
      validated_at TEXT NOT NULL DEFAULT (datetime('now')),
      scheduled_at TEXT,
      is_late INTEGER DEFAULT 0,
      local_id TEXT UNIQUE,
      synced_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS products_in_stock (
      id TEXT PRIMARY KEY,
      establishment_id TEXT NOT NULL,
      product_name TEXT NOT NULL,
      category TEXT,
      dlc_primary TEXT,
      dlc_secondary TEXT,
      opened_at TEXT,
      lot_number TEXT,
      supplier_id TEXT,
      status TEXT DEFAULT 'in_stock',
      destruction_reason TEXT,
      destruction_photo_path TEXT,
      destroyed_at TEXT,
      local_id TEXT UNIQUE,
      synced_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS oil_controls (
      id TEXT PRIMARY KEY,
      establishment_id TEXT NOT NULL,
      equipment_id TEXT NOT NULL,
      control_type TEXT NOT NULL,
      tpm_value REAL,
      tpm_compliant INTEGER,
      photo_path TEXT,
      waste_collector TEXT,
      waste_receipt_photo_path TEXT,
      recorded_by TEXT,
      recorded_at TEXT DEFAULT (datetime('now')),
      local_id TEXT UNIQUE,
      synced_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS pest_controls (
      id TEXT PRIMARY KEY,
      establishment_id TEXT NOT NULL,
      control_type TEXT NOT NULL,
      checkpoint_name TEXT,
      is_anomaly INTEGER DEFAULT 0,
      pest_type TEXT,
      location_description TEXT,
      photo_path TEXT,
      intervention_date TEXT,
      service_provider TEXT,
      next_visit_date TEXT,
      recorded_by TEXT,
      recorded_at TEXT DEFAULT (datetime('now')),
      local_id TEXT UNIQUE,
      synced_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS blockchain_queue (
      id TEXT PRIMARY KEY,
      establishment_id TEXT NOT NULL,
      record_type TEXT NOT NULL,
      record_id TEXT NOT NULL,
      data_hash TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      tx_hash TEXT,
      submitted_at TEXT,
      confirmed_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ddpp_reports (
      id TEXT PRIMARY KEY,
      establishment_id TEXT NOT NULL,
      report_date TEXT NOT NULL,
      period_start TEXT NOT NULL,
      period_end TEXT NOT NULL,
      pdf_path TEXT,
      qr_code_verification TEXT,
      generated_by TEXT,
      generated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sync_queue (
      id TEXT PRIMARY KEY,
      table_name TEXT NOT NULL,
      record_id TEXT NOT NULL,
      operation TEXT NOT NULL,
      data TEXT NOT NULL,
      photo_paths TEXT,
      status TEXT DEFAULT 'pending',
      retry_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      synced_at TEXT,
      error_message TEXT
    );
  `);
}

export async function generateLocalId(): Promise<string> {
  return Crypto.randomUUID();
}

export async function insertLocal(table: string, data: Record<string, unknown>): Promise<string> {
  const database = await getDatabase();
  const localId = await generateLocalId();
  const id = (data.id as string) || localId;
  const record: Record<string, unknown> = { ...data, id, local_id: localId };

  const columns = Object.keys(record);
  const placeholders = columns.map(() => '?').join(', ');
  const values = columns.map((col) => {
    const val = record[col];
    if (typeof val === 'boolean') return val ? 1 : 0;
    if (val === null || val === undefined) return null;
    if (typeof val === 'object') return JSON.stringify(val);
    return val;
  });

  await database.runAsync(
    `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`,
    values as (string | number | null)[]
  );

  // Add to sync queue
  await database.runAsync(
    `INSERT INTO sync_queue (id, table_name, record_id, operation, data, status) VALUES (?, ?, ?, ?, ?, ?)`,
    [await generateLocalId(), table, id, 'INSERT', JSON.stringify(record), 'pending']
  );

  return id;
}

export async function updateLocal(table: string, id: string, data: Record<string, unknown>): Promise<void> {
  const database = await getDatabase();
  const columns = Object.keys(data);
  const setClause = columns.map((col) => `${col} = ?`).join(', ');
  const values = columns.map((col) => {
    const val = data[col];
    if (typeof val === 'boolean') return val ? 1 : 0;
    if (val === null || val === undefined) return null;
    if (typeof val === 'object') return JSON.stringify(val);
    return val;
  });

  await database.runAsync(
    `UPDATE ${table} SET ${setClause} WHERE id = ?`,
    [...(values as (string | number | null)[]), id]
  );

  // Add to sync queue
  await database.runAsync(
    `INSERT INTO sync_queue (id, table_name, record_id, operation, data, status) VALUES (?, ?, ?, ?, ?, ?)`,
    [await generateLocalId(), table, id, 'UPDATE', JSON.stringify(data), 'pending']
  );
}

export async function deleteLocal(table: string, id: string): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(`DELETE FROM ${table} WHERE id = ?`, [id]);

  await database.runAsync(
    `INSERT INTO sync_queue (id, table_name, record_id, operation, data, status) VALUES (?, ?, ?, ?, ?, ?)`,
    [await generateLocalId(), table, id, 'DELETE', '{}', 'pending']
  );
}

export async function getAllLocal<T>(table: string, where?: string, params?: (string | number | null)[]): Promise<T[]> {
  const database = await getDatabase();
  const query = where ? `SELECT * FROM ${table} WHERE ${where}` : `SELECT * FROM ${table}`;
  const result = await database.getAllAsync(query, params || []);
  return result as T[];
}

export async function getByIdLocal<T>(table: string, id: string): Promise<T | null> {
  const database = await getDatabase();
  const result = await database.getFirstAsync(`SELECT * FROM ${table} WHERE id = ?`, [id]);
  return (result as T) || null;
}
