/**
 * Tests for the tamper-evident hash chain.
 *
 * The global jest.setup.js mock for expo-crypto returns a deterministic
 * fake hash ("mock-hash-…") which is fine for code that just stores the
 * value, but useless to validate the actual chaining + tamper detection
 * logic. We override the mock here with a real SHA-256 from Node's
 * built-in `crypto` module so we exercise computeChainHash for real.
 */
/* eslint-disable import/first -- jest.mock hoisting */
jest.mock('expo-crypto', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createHash } = require('crypto');
  return {
    digestStringAsync: jest.fn((_algo: string, input: string) =>
      Promise.resolve(createHash('sha256').update(input).digest('hex')),
    ),
    CryptoDigestAlgorithm: { SHA256: 'SHA-256', SHA512: 'SHA-512' },
    randomUUID: jest.fn(() => 'test-uuid'),
  };
});

import {
  computeChainHash,
  verifyChain,
  GENESIS_HASH,
  shortHash,
} from './hashChain';

// ── Fixtures: we rebuild a deterministic "meat then fish" delivery
// payload pair that mirrors what src/services/demoData.ts seeds, but
// with frozen dates so the expected hash is reproducible.
const FROZEN_DATE = '2026-05-20';
const MEAT_RECORDED_AT = '2026-05-20T06:15:00.000Z';
const FISH_RECORDED_AT = '2026-05-20T07:05:00.000Z';
const EST_ID = 'demo-establishment-001';

const meatItems = [
  {
    product_name: 'Filet de bœuf race Charolaise',
    category: 'viande',
    temperature: 2.8,
    dlc: '2026-05-26',
    lot_number: 'L2026-0401',
    photo_paths: null,
  },
  {
    product_name: 'Onglet de bœuf',
    category: 'viande',
    temperature: 3.1,
    dlc: '2026-05-25',
    lot_number: 'L2026-0402',
    photo_paths: null,
  },
];

const fishItems = [
  {
    product_name: 'Saumon Atlantique entier',
    category: 'poisson',
    temperature: 1.2,
    dlc: '2026-05-22',
    lot_number: 'L2026-0412',
    photo_paths: null,
  },
];

const meatPayload = {
  supplier_id: 'sup-1',
  establishment_id: EST_ID,
  delivery_date: FROZEN_DATE,
  recorded_at: MEAT_RECORDED_AT,
  items: meatItems,
};

const fishPayload = {
  supplier_id: 'sup-2',
  establishment_id: EST_ID,
  delivery_date: FROZEN_DATE,
  recorded_at: FISH_RECORDED_AT,
  items: fishItems,
};

describe('computeChainHash', () => {
  it('produces a 64-char hex digest', async () => {
    const h = await computeChainHash(GENESIS_HASH, meatPayload);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is deterministic for the same input', async () => {
    const h1 = await computeChainHash(GENESIS_HASH, meatPayload);
    const h2 = await computeChainHash(GENESIS_HASH, meatPayload);
    expect(h1).toBe(h2);
  });

  it('is insensitive to JSON key ordering (canonical)', async () => {
    const reordered = {
      // intentionally rebuild with shuffled keys
      items: meatPayload.items,
      delivery_date: meatPayload.delivery_date,
      establishment_id: meatPayload.establishment_id,
      recorded_at: meatPayload.recorded_at,
      supplier_id: meatPayload.supplier_id,
    };
    const original = await computeChainHash(GENESIS_HASH, meatPayload);
    const shuffled = await computeChainHash(GENESIS_HASH, reordered);
    expect(shuffled).toBe(original);
  });

  it('chains: meat hash feeds fish hash, both differ', async () => {
    const meatHash = await computeChainHash(GENESIS_HASH, meatPayload);
    const fishHash = await computeChainHash(meatHash, fishPayload);
    expect(meatHash).not.toBe(fishHash);
    // also different from what we'd get if fish was chained on GENESIS
    const fishOnGenesis = await computeChainHash(GENESIS_HASH, fishPayload);
    expect(fishHash).not.toBe(fishOnGenesis);
  });

  it('detects mutation: changing a single field flips the hash', async () => {
    const baseline = await computeChainHash(GENESIS_HASH, meatPayload);
    const tampered = {
      ...meatPayload,
      items: meatPayload.items.map((it, i) =>
        i === 0 ? { ...it, temperature: 99 } : it,
      ),
    };
    const mutated = await computeChainHash(GENESIS_HASH, tampered);
    expect(mutated).not.toBe(baseline);
  });
});

describe('verifyChain', () => {
  // Helper: builds a "stored" delivery (with its blockchain_hash baked in)
  // for a payload, mimicking what the SQLite seed does.
  async function makeStored(prev: string, supplierId: string, recordedAt: string, items: typeof meatItems) {
    const payload = {
      supplier_id: supplierId,
      establishment_id: EST_ID,
      delivery_date: FROZEN_DATE,
      recorded_at: recordedAt,
      items,
    };
    const hash = await computeChainHash(prev, payload);
    return {
      delivery: {
        id: `del-${supplierId}`,
        supplier_id: supplierId,
        establishment_id: EST_ID,
        delivery_date: FROZEN_DATE,
        recorded_at: recordedAt,
        status: 'accepted',
        blockchain_hash: hash,
      },
      items,
      hash,
    };
  }

  it('returns ok=true on an intact 2-link chain', async () => {
    const meat = await makeStored(GENESIS_HASH, 'sup-1', MEAT_RECORDED_AT, meatItems);
    // The seed chains fish onto meat's actual stored hash, mirroring demoData.ts.
    const fish = await makeStored(meat.hash, 'sup-2', FISH_RECORDED_AT, fishItems);

    const result = await verifyChain(
      [meat.delivery, fish.delivery],
      {
        [meat.delivery.id]: meat.items,
        [fish.delivery.id]: fish.items,
      },
    );
    expect(result.ok).toBe(true);
    expect(result.totalChecked).toBe(2);
    expect(result.firstBreakAt).toBeNull();
  });

  it('returns ok=false and pinpoints the broken link when an item is mutated', async () => {
    const meat = await makeStored(GENESIS_HASH, 'sup-1', MEAT_RECORDED_AT, meatItems);
    const fish = await makeStored(meat.hash, 'sup-2', FISH_RECORDED_AT, fishItems);

    // Tamper: rewrite the meat items as they would be re-read from the DB
    // (e.g. someone edited the temperature in SQL directly) — the stored
    // blockchain_hash stays the original, but recompute now diverges.
    const tamperedMeatItems = meatItems.map((it, i) =>
      i === 0 ? { ...it, temperature: 99 } : it,
    );

    const result = await verifyChain(
      [meat.delivery, fish.delivery],
      {
        [meat.delivery.id]: tamperedMeatItems,
        [fish.delivery.id]: fish.items,
      },
    );
    expect(result.ok).toBe(false);
    expect(result.firstBreakAt).toBe(meat.delivery.id);
    expect(result.breakReason).toMatch(/Hash recalculé/);
  });

  it('detects a break mid-chain (genesis → meat ok, fish tampered)', async () => {
    const meat = await makeStored(GENESIS_HASH, 'sup-1', MEAT_RECORDED_AT, meatItems);
    const fish = await makeStored(meat.hash, 'sup-2', FISH_RECORDED_AT, fishItems);

    const tamperedFishItems = fishItems.map((it) => ({ ...it, temperature: 17 }));

    const result = await verifyChain(
      [meat.delivery, fish.delivery],
      {
        [meat.delivery.id]: meat.items,
        [fish.delivery.id]: tamperedFishItems,
      },
    );
    expect(result.ok).toBe(false);
    expect(result.firstBreakAt).toBe(fish.delivery.id);
    expect(result.totalChecked).toBe(2);
  });

  it('skips deliveries without a stored blockchain_hash (pre-chain rows)', async () => {
    const meat = await makeStored(GENESIS_HASH, 'sup-1', MEAT_RECORDED_AT, meatItems);
    const legacy = {
      id: 'legacy-1',
      supplier_id: null,
      establishment_id: EST_ID,
      delivery_date: '2024-01-01',
      recorded_at: '2024-01-01T00:00:00.000Z',
      status: 'accepted',
      blockchain_hash: null,
    };
    const result = await verifyChain(
      [legacy, meat.delivery],
      { [meat.delivery.id]: meat.items },
    );
    expect(result.ok).toBe(true);
    expect(result.totalChecked).toBe(1); // legacy skipped
  });
});

describe('shortHash', () => {
  it('returns em dash for empty', () => {
    expect(shortHash(null)).toBe('—');
    expect(shortHash(undefined)).toBe('—');
  });

  it('renders 8…8 format for a 64-char hex', () => {
    const h = '8e6c5dfcd49d68d04c8a04ed8bb1f8c4d27d77cf3df5cf3e93ad58e6eaf66bf2';
    expect(shortHash(h)).toBe('8e6c5dfc…eaf66bf2');
  });

  it('returns short strings unchanged', () => {
    expect(shortHash('abcd')).toBe('abcd');
  });
});
