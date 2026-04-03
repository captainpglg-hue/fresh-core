import { getDatabase } from './database';
import { hashRecord } from '../utils/hash';
import { buildMerkleTree } from '../utils/merkle';
import { generateLocalId } from './database';

const RECORD_TABLES = [
  'temperature_readings',
  'deliveries',
  'cleaning_records',
  'oil_controls',
  'pest_controls',
];

export async function processDailyBatch(establishmentId: string): Promise<{ merkleRoot: string; recordCount: number }> {
  const db = await getDatabase();
  const today = new Date().toISOString().split('T')[0];
  const hashes: string[] = [];

  for (const table of RECORD_TABLES) {
    const records = await db.getAllAsync(
      `SELECT * FROM ${table} WHERE establishment_id = ? AND date(created_at) = ? AND blockchain_hash IS NULL`,
      [establishmentId, today]
    );

    for (const record of records) {
      const hash = await hashRecord(record);
      hashes.push(hash);

      // Update the record with its hash
      await db.runAsync(
        `UPDATE ${table} SET blockchain_hash = ? WHERE id = ?`,
        [hash, (record as Record<string, unknown>).id as string]
      );
    }
  }

  if (hashes.length === 0) {
    return { merkleRoot: '', recordCount: 0 };
  }

  const { root } = await buildMerkleTree(hashes);

  // Save to blockchain queue
  const queueId = await generateLocalId();
  await db.runAsync(
    `INSERT INTO blockchain_queue (id, establishment_id, record_type, record_id, data_hash, status) VALUES (?, ?, ?, ?, ?, ?)`,
    [queueId, establishmentId, 'daily_batch', today, root, 'pending']
  );

  if (__DEV__) {
    console.log(`[Blockchain] Daily batch: ${hashes.length} records, Merkle root: ${root}`);
  }

  return { merkleRoot: root, recordCount: hashes.length };
}
