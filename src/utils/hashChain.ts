import * as Crypto from 'expo-crypto';

/**
 * Genesis hash used as the "previous" pointer for the very first record
 * in a chain. Any 64-char hex string works; we use SHA-256 of the literal
 * string "fresh-core/genesis" so the genesis is deterministic and
 * documentable.
 */
export const GENESIS_HASH =
  '8e6c5dfcd49d68d04c8a04ed8bb1f8c4d27d77cf3df5cf3e93ad58e6eaf66bf2';

/**
 * Compute SHA-256(prevHash || canonicalJson(payload)). Canonical JSON
 * keys are sorted alphabetically so the hash is reproducible across
 * platforms (insertion order in JSON.stringify is not guaranteed for
 * objects built by spread / db reads).
 *
 * This is NOT a public blockchain (no PoW, no distributed consensus) —
 * it's a tamper-evident local audit chain. Each entry depends on its
 * predecessor, so altering an old reception silently is detectable: the
 * stored chain hashes stop matching when you recompute them.
 *
 * Intended to be anchored to a public chain (Polygon, Bitcoin OP_RETURN…)
 * once per day in V2 — only the daily Merkle root needs to be on-chain,
 * not every individual record.
 */
export async function computeChainHash(
  prevHash: string,
  payload: Record<string, unknown>,
): Promise<string> {
  const canonical = canonicalJson(payload);
  const input = `${prevHash}|${canonical}`;
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, input);
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  const parts = keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`);
  return `{${parts.join(',')}}`;
}

/**
 * Render an 8/8 short form of a 64-char hash, e.g. "8e6c5dfc…eaf66bf2",
 * for UI labels where the full hash would be unreadable.
 */
export function shortHash(hash: string | null | undefined): string {
  if (!hash) return '—';
  if (hash.length < 16) return hash;
  return `${hash.slice(0, 8)}…${hash.slice(-8)}`;
}

export interface ChainVerification {
  ok: boolean;
  totalChecked: number;
  firstBreakAt: string | null;
  breakReason: string | null;
}

/**
 * Walks every delivery for an establishment in chronological order, re-
 * computes each blockchain_hash from the stored payload + previous hash,
 * and confirms it matches what was persisted. Returns the first divergence
 * (if any) so the UI can highlight which reception was tampered with.
 *
 * Pure (read-only) — safe to call from any screen.
 */
type VerifiableDelivery = {
  id: string;
  supplier_id: string | null;
  establishment_id: string;
  delivery_date: string;
  recorded_at: string;
  status: string;
  refusal_reason?: string | null;
  blockchain_hash: string | null;
};

type VerifiableItem = {
  product_name: string | null;
  category: string | null;
  temperature: number | null;
  dlc: string | null;
  lot_number: string | null;
  photo_paths: string[] | null;
};

export async function verifyChain(
  deliveries: VerifiableDelivery[],
  itemsByDeliveryId: Record<string, VerifiableItem[]>,
): Promise<ChainVerification> {
  const sorted = [...deliveries].sort((a, b) =>
    a.recorded_at.localeCompare(b.recorded_at),
  );
  let prev = GENESIS_HASH;
  let checked = 0;
  for (const d of sorted) {
    if (!d.blockchain_hash) continue;
    const items = itemsByDeliveryId[d.id] ?? [];
    const payload =
      d.status === 'refused'
        ? {
            supplier_id: d.supplier_id ?? null,
            establishment_id: d.establishment_id,
            delivery_date: d.delivery_date,
            recorded_at: d.recorded_at,
            status: 'refused',
            refusal_reason: d.refusal_reason ?? null,
          }
        : {
            supplier_id: d.supplier_id ?? null,
            establishment_id: d.establishment_id,
            delivery_date: d.delivery_date,
            recorded_at: d.recorded_at,
            items: items.map((it) => ({
              product_name: it.product_name ?? null,
              category: it.category ?? null,
              temperature: it.temperature ?? null,
              dlc: it.dlc ?? null,
              lot_number: it.lot_number ?? null,
              photo_paths: it.photo_paths ?? null,
            })),
          };
    const expected = await computeChainHash(prev, payload);
    checked += 1;
    if (expected !== d.blockchain_hash) {
      return {
        ok: false,
        totalChecked: checked,
        firstBreakAt: d.id,
        breakReason: `Hash recalculé ${shortHash(expected)} ≠ enregistré ${shortHash(d.blockchain_hash)}`,
      };
    }
    prev = d.blockchain_hash;
  }
  return { ok: true, totalChecked: checked, firstBreakAt: null, breakReason: null };
}
