// Mock expo-sqlite avant l'import du module testé.
const mockDb = {
  execAsync: jest.fn(),
  getAllAsync: jest.fn(() => Promise.resolve([] as unknown[])),
  getFirstAsync: jest.fn(() => Promise.resolve(null as unknown)),
  runAsync: jest.fn(() => Promise.resolve({ lastInsertRowId: 1, changes: 1 })),
};

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(() => Promise.resolve(mockDb)),
}));

// Hash déterministe basé sur le matériel : permet de vérifier la chaîne sans
// dépendre du vrai SHA-256 natif.
jest.mock('expo-crypto', () => {
  let uuidCounter = 0;
  return {
    randomUUID: jest.fn(() => `uuid-${++uuidCounter}`),
    digestStringAsync: jest.fn(async (_algo: string, input: string) => {
      // Hash mock stable : concat marker + longueur + 8 premiers chars hex.
      let h = 0;
      for (let i = 0; i < input.length; i++) {
        h = (h * 31 + input.charCodeAt(i)) | 0;
      }
      const hex = (h >>> 0).toString(16).padStart(8, '0');
      return `mock-${input.length}-${hex}-${input.slice(0, 8).replace(/[^a-z0-9]/gi, 'x')}`;
    }),
    CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  };
});

import {
  computeEventHash,
  generateLotCode,
  createLot,
  appendEvent,
  verifyLotChain,
} from './lotChain';
import type { LotEvent, Lot } from '../types/lotChain';

describe('lotChain', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDb.getFirstAsync.mockReset();
    mockDb.getAllAsync.mockReset();
    mockDb.runAsync.mockReset();
    mockDb.runAsync.mockResolvedValue({ lastInsertRowId: 1, changes: 1 });
  });

  describe('computeEventHash', () => {
    it('produit un hash stable pour un input identique', async () => {
      const h1 = await computeEventHash({
        prevHash: null,
        sequence: 1,
        type: 'CREATE',
        actorId: 'actor-1',
        actorMaillon: 'pecheur',
        payload: { espece: 'thon', zone_peche: 'FAO-27' },
        occurredAt: '2026-05-23T10:00:00Z',
      });
      const h2 = await computeEventHash({
        prevHash: null,
        sequence: 1,
        type: 'CREATE',
        actorId: 'actor-1',
        actorMaillon: 'pecheur',
        payload: { espece: 'thon', zone_peche: 'FAO-27' },
        occurredAt: '2026-05-23T10:00:00Z',
      });
      expect(h1).toBe(h2);
    });

    it("est stable quel que soit l'ordre des clés du payload (JSON canonique)", async () => {
      const h1 = await computeEventHash({
        prevHash: null,
        sequence: 1,
        type: 'CREATE',
        actorId: 'actor-1',
        actorMaillon: 'pecheur',
        payload: { espece: 'thon', zone_peche: 'FAO-27', bateau: 'A12' },
        occurredAt: '2026-05-23T10:00:00Z',
      });
      const h2 = await computeEventHash({
        prevHash: null,
        sequence: 1,
        type: 'CREATE',
        actorId: 'actor-1',
        actorMaillon: 'pecheur',
        payload: { bateau: 'A12', zone_peche: 'FAO-27', espece: 'thon' },
        occurredAt: '2026-05-23T10:00:00Z',
      });
      expect(h1).toBe(h2);
    });

    it('change si un champ payload change', async () => {
      const base = {
        prevHash: null,
        sequence: 1,
        type: 'CREATE' as const,
        actorId: 'actor-1',
        actorMaillon: 'pecheur' as const,
        occurredAt: '2026-05-23T10:00:00Z',
      };
      const h1 = await computeEventHash({ ...base, payload: { espece: 'thon' } });
      const h2 = await computeEventHash({ ...base, payload: { espece: 'sardine' } });
      expect(h1).not.toBe(h2);
    });

    it('change si la séquence change', async () => {
      const base = {
        prevHash: 'prev',
        type: 'TRANSFER' as const,
        actorId: 'actor-1',
        actorMaillon: 'mareyeur' as const,
        payload: {},
        occurredAt: '2026-05-23T10:00:00Z',
      };
      const h1 = await computeEventHash({ ...base, sequence: 2 });
      const h2 = await computeEventHash({ ...base, sequence: 3 });
      expect(h1).not.toBe(h2);
    });
  });

  describe('generateLotCode', () => {
    it('renvoie un code de 16 caractères dérivé du SHA-256, en majuscules', async () => {
      const code = await generateLotCode('peche', 'pecheur', 'actor-1');
      expect(code).toHaveLength(16);
      // Sous le vrai SHA-256, le code est hex pur. Sous le mock, on tolère
      // simplement la longueur fixe + majuscules.
      expect(code).toBe(code.toUpperCase());
    });
  });

  describe('createLot', () => {
    it('insère un lot + 1 event CREATE et calcule head_hash', async () => {
      const lot = await createLot({
        filiere: 'peche',
        maillonOrigin: 'pecheur',
        productName: 'Thon rouge',
        actorId: 'actor-1',
        establishmentId: 'est-1',
        payload: { espece: 'thon', zone_peche: 'FAO-27' },
        occurredAt: '2026-05-23T10:00:00Z',
      });

      expect(lot.filiere).toBe('peche');
      expect(lot.maillon_origin).toBe('pecheur');
      expect(lot.head_sequence).toBe(1);
      expect(lot.head_hash).toBeTruthy();
      expect(lot.status).toBe('active');

      // 2 INSERT lots + lot_events, + 2 INSERT sync_queue.
      const calls = mockDb.runAsync.mock.calls as unknown as Array<[string, unknown]>;
      const inserts = calls.filter((c) => /^INSERT/.test(c[0]));
      expect(inserts.length).toBe(4);
    });
  });

  describe('appendEvent', () => {
    it('refuse un event sur un lot consommé', async () => {
      mockDb.getFirstAsync.mockResolvedValue({
        id: 'lot-1',
        lot_code: 'ABC123',
        status: 'consumed',
        head_hash: 'h0',
        head_sequence: 1,
      } as unknown as Lot);

      await expect(
        appendEvent({
          lotId: 'lot-1',
          type: 'CONTROL',
          actorId: 'actor-2',
          actorMaillon: 'restaurateur',
          establishmentId: 'est-2',
          payload: { control_type: 'temperature', value: 4 },
        })
      ).rejects.toThrow(/consumed/);
    });

    it('chaîne l\'event au prev_hash et incrémente la séquence', async () => {
      mockDb.getFirstAsync.mockResolvedValue({
        id: 'lot-1',
        lot_code: 'ABC123',
        status: 'active',
        head_hash: 'h0',
        head_sequence: 1,
      } as unknown as Lot);

      const ev = await appendEvent({
        lotId: 'lot-1',
        type: 'TRANSFER',
        actorId: 'actor-2',
        actorMaillon: 'mareyeur',
        establishmentId: 'est-2',
        payload: { from_maillon: 'pecheur', to_maillon: 'mareyeur', temperature_transport: 2 },
        occurredAt: '2026-05-23T12:00:00Z',
        newHolderId: 'actor-2',
        newEstablishmentId: 'est-2',
      });

      expect(ev.sequence).toBe(2);
      expect(ev.prev_hash).toBe('h0');
      expect(ev.hash).toBeTruthy();
      expect(ev.hash).not.toBe('h0');
    });
  });

  describe('verifyLotChain', () => {
    it("retourne ok=true quand chaque hash matche le recalcul", async () => {
      const eventA = {
        id: 'e1',
        lot_id: 'lot-1',
        sequence: 1,
        type: 'CREATE' as const,
        actor_id: 'a1',
        actor_maillon: 'pecheur' as const,
        payload: { espece: 'thon' },
        prev_hash: null,
        occurred_at: '2026-05-23T10:00:00Z',
        photo_paths: null,
        establishment_id: null,
        signature: null,
        created_at: '2026-05-23T10:00:00Z',
      };
      const hashA = await computeEventHash({
        prevHash: null,
        sequence: 1,
        type: 'CREATE',
        actorId: 'a1',
        actorMaillon: 'pecheur',
        payload: { espece: 'thon' },
        occurredAt: '2026-05-23T10:00:00Z',
      });
      const eventB = {
        id: 'e2',
        lot_id: 'lot-1',
        sequence: 2,
        type: 'TRANSFER' as const,
        actor_id: 'a2',
        actor_maillon: 'mareyeur' as const,
        payload: { to_maillon: 'mareyeur' },
        prev_hash: hashA,
        occurred_at: '2026-05-23T12:00:00Z',
        photo_paths: null,
        establishment_id: null,
        signature: null,
        created_at: '2026-05-23T12:00:00Z',
      };
      const hashB = await computeEventHash({
        prevHash: hashA,
        sequence: 2,
        type: 'TRANSFER',
        actorId: 'a2',
        actorMaillon: 'mareyeur',
        payload: { to_maillon: 'mareyeur' },
        occurredAt: '2026-05-23T12:00:00Z',
      });

      mockDb.getAllAsync.mockResolvedValue([
        { ...eventA, hash: hashA, payload: JSON.stringify(eventA.payload) },
        { ...eventB, hash: hashB, payload: JSON.stringify(eventB.payload) },
      ] as unknown as LotEvent[]);

      const res = await verifyLotChain('lot-1');
      expect(res.ok).toBe(true);
      expect(res.brokenAtSequence).toBeNull();
    });

    it("détecte une chaîne tampered (hash modifié)", async () => {
      const eventA = {
        id: 'e1',
        lot_id: 'lot-1',
        sequence: 1,
        type: 'CREATE' as const,
        actor_id: 'a1',
        actor_maillon: 'pecheur' as const,
        payload: { espece: 'thon' },
        prev_hash: null,
        occurred_at: '2026-05-23T10:00:00Z',
        photo_paths: null,
        establishment_id: null,
        signature: null,
        created_at: '2026-05-23T10:00:00Z',
      };

      mockDb.getAllAsync.mockResolvedValue([
        { ...eventA, hash: 'TAMPERED', payload: JSON.stringify(eventA.payload) },
      ] as unknown as LotEvent[]);

      const res = await verifyLotChain('lot-1');
      expect(res.ok).toBe(false);
      expect(res.brokenAtSequence).toBe(1);
    });
  });
});
