import { computeSHA256 } from './merkle';

export async function hashRecord(record: unknown): Promise<string> {
  const data = JSON.stringify(record, Object.keys(record as Record<string, unknown>).sort());
  return computeSHA256(data);
}
