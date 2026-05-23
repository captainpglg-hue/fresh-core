import * as Crypto from 'expo-crypto';
import { getDatabase, insertLocal, generateLocalId } from './database';
import type {
  Filiere,
  Maillon,
  Lot,
  LotEvent,
  LotEventType,
  LotEventPayload,
  LotLink,
} from '../types/lotChain';

// ============================================================================
// Hash chain
// ============================================================================

/**
 * Canonical JSON serializer : trie les clés à tous les niveaux pour que le
 * hash soit stable et reproductible (même payload sémantique → même hash).
 */
function canonicalize(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'number' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return '[' + value.map(canonicalize).join(',') + ']';
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    return '{' + keys.map((k) => JSON.stringify(k) + ':' + canonicalize(obj[k])).join(',') + '}';
  }
  return JSON.stringify(value);
}

interface EventHashInput {
  prevHash: string | null;
  sequence: number;
  type: LotEventType;
  actorId: string | null;
  actorMaillon: Maillon | null;
  payload: LotEventPayload;
  occurredAt: string;
}

export async function computeEventHash(input: EventHashInput): Promise<string> {
  const material =
    (input.prevHash || '') +
    '|' +
    input.sequence +
    '|' +
    input.type +
    '|' +
    (input.actorId || '') +
    '|' +
    (input.actorMaillon || '') +
    '|' +
    input.occurredAt +
    '|' +
    canonicalize(input.payload);
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, material);
}

/**
 * lot_code public = sha256(filiere || maillon || actorId || ts || random).slice(0,16).
 * Court mais collision-résistant en pratique (16 hex = 64 bits). Embarqué tel
 * quel dans le QR. La forme courte facilite la saisie manuelle en backup.
 */
export async function generateLotCode(filiere: Filiere, maillon: Maillon, actorId: string): Promise<string> {
  const ts = Date.now().toString();
  const random = await generateLocalId();
  const material = `${filiere}|${maillon}|${actorId}|${ts}|${random}`;
  const full = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, material);
  return full.slice(0, 16).toUpperCase();
}

// ============================================================================
// Lot mutators (offline-first via SQLite + sync_queue)
// ============================================================================

export interface CreateLotInput {
  filiere: Filiere;
  maillonOrigin: Maillon;
  productName: string;
  productCategory?: string;
  unit?: string;
  quantity?: number;
  actorId: string;
  establishmentId: string;
  payload: LotEventPayload;
  photoPaths?: string[];
  occurredAt?: string;
}

export async function createLot(input: CreateLotInput): Promise<Lot> {
  const occurredAt = input.occurredAt || new Date().toISOString();
  const lotId = await generateLocalId();
  const lotCode = await generateLotCode(input.filiere, input.maillonOrigin, input.actorId);

  const eventHash = await computeEventHash({
    prevHash: null,
    sequence: 1,
    type: 'CREATE',
    actorId: input.actorId,
    actorMaillon: input.maillonOrigin,
    payload: input.payload,
    occurredAt,
  });

  await insertLocal('lots', {
    id: lotId,
    lot_code: lotCode,
    filiere: input.filiere,
    maillon_origin: input.maillonOrigin,
    product_name: input.productName,
    product_category: input.productCategory ?? null,
    unit: input.unit ?? null,
    quantity: input.quantity ?? null,
    current_holder_id: input.actorId,
    current_establishment_id: input.establishmentId,
    status: 'active',
    head_hash: eventHash,
    head_sequence: 1,
  });

  await insertLocal('lot_events', {
    id: await generateLocalId(),
    lot_id: lotId,
    sequence: 1,
    type: 'CREATE',
    actor_id: input.actorId,
    actor_maillon: input.maillonOrigin,
    establishment_id: input.establishmentId,
    payload: input.payload,
    photo_paths: input.photoPaths ?? null,
    prev_hash: null,
    hash: eventHash,
    occurred_at: occurredAt,
  });

  return {
    id: lotId,
    lot_code: lotCode,
    filiere: input.filiere,
    maillon_origin: input.maillonOrigin,
    product_name: input.productName,
    product_category: input.productCategory ?? null,
    unit: input.unit ?? null,
    quantity: input.quantity ?? null,
    current_holder_id: input.actorId,
    current_establishment_id: input.establishmentId,
    status: 'active',
    head_hash: eventHash,
    head_sequence: 1,
    anchored_at: null,
    anchor_tx_hash: null,
    created_at: occurredAt,
  };
}

export interface AppendEventInput {
  lotId: string;
  type: Exclude<LotEventType, 'CREATE'>;
  actorId: string;
  actorMaillon: Maillon;
  establishmentId: string;
  payload: LotEventPayload;
  photoPaths?: string[];
  occurredAt?: string;
  // Pour TRANSFORM : codes des lots parents (consommés à cet event)
  parentLotIds?: string[];
  // Pour TRANSFER : nouveau détenteur (peut être l'actor lui-même si self-transport)
  newHolderId?: string;
  newEstablishmentId?: string;
}

export async function appendEvent(input: AppendEventInput): Promise<LotEvent> {
  const occurredAt = input.occurredAt || new Date().toISOString();
  const db = await getDatabase();

  const lotRow = (await db.getFirstAsync(`SELECT * FROM lots WHERE id = ?`, [input.lotId])) as Lot | null;
  if (!lotRow) throw new Error(`Lot introuvable: ${input.lotId}`);
  if (lotRow.status !== 'active') throw new Error(`Lot ${lotRow.lot_code} déjà ${lotRow.status}`);

  const sequence = lotRow.head_sequence + 1;
  const prevHash = lotRow.head_hash;

  const eventHash = await computeEventHash({
    prevHash,
    sequence,
    type: input.type,
    actorId: input.actorId,
    actorMaillon: input.actorMaillon,
    payload: input.payload,
    occurredAt,
  });

  const eventId = await generateLocalId();
  await insertLocal('lot_events', {
    id: eventId,
    lot_id: input.lotId,
    sequence,
    type: input.type,
    actor_id: input.actorId,
    actor_maillon: input.actorMaillon,
    establishment_id: input.establishmentId,
    payload: input.payload,
    photo_paths: input.photoPaths ?? null,
    prev_hash: prevHash,
    hash: eventHash,
    occurred_at: occurredAt,
  });

  // Update lot head + status si CONSUME/DESTROY + holder si TRANSFER
  const updates: Record<string, unknown> = {
    head_hash: eventHash,
    head_sequence: sequence,
  };
  if (input.type === 'CONSUME') updates.status = 'consumed';
  if (input.type === 'DESTROY') updates.status = 'destroyed';
  if (input.type === 'TRANSFER') {
    if (input.newHolderId) updates.current_holder_id = input.newHolderId;
    if (input.newEstablishmentId) updates.current_establishment_id = input.newEstablishmentId;
  }
  const setClause = Object.keys(updates)
    .map((k) => `${k} = ?`)
    .join(', ');
  await db.runAsync(`UPDATE lots SET ${setClause} WHERE id = ?`, [
    ...(Object.values(updates) as (string | number | null)[]),
    input.lotId,
  ]);

  // Links parent->enfant si TRANSFORM
  if (input.type === 'TRANSFORM' && input.parentLotIds && input.parentLotIds.length > 0) {
    for (const parentId of input.parentLotIds) {
      await insertLocal('lot_links', {
        id: await generateLocalId(),
        parent_lot_id: parentId,
        child_lot_id: input.lotId,
        transform_event_id: eventId,
      });
    }
  }

  return {
    id: eventId,
    lot_id: input.lotId,
    sequence,
    type: input.type,
    actor_id: input.actorId,
    actor_maillon: input.actorMaillon,
    establishment_id: input.establishmentId,
    payload: input.payload as Record<string, unknown>,
    photo_paths: input.photoPaths ?? null,
    prev_hash: prevHash,
    hash: eventHash,
    signature: null,
    occurred_at: occurredAt,
    created_at: occurredAt,
  };
}

// ============================================================================
// Queries
// ============================================================================

export async function getLotByCode(lotCode: string): Promise<Lot | null> {
  const db = await getDatabase();
  const row = (await db.getFirstAsync(`SELECT * FROM lots WHERE lot_code = ?`, [lotCode])) as Lot | null;
  return row || null;
}

export async function getLotById(lotId: string): Promise<Lot | null> {
  const db = await getDatabase();
  const row = (await db.getFirstAsync(`SELECT * FROM lots WHERE id = ?`, [lotId])) as Lot | null;
  return row || null;
}

export async function getLotEvents(lotId: string): Promise<LotEvent[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync(
    `SELECT * FROM lot_events WHERE lot_id = ? ORDER BY sequence ASC`,
    [lotId]
  );
  return (rows as LotEvent[]).map((e) => ({
    ...e,
    payload: typeof e.payload === 'string' ? JSON.parse(e.payload as unknown as string) : e.payload,
    photo_paths:
      typeof e.photo_paths === 'string' ? JSON.parse(e.photo_paths as unknown as string) : e.photo_paths,
  }));
}

export async function getLotParents(lotId: string): Promise<LotLink[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync(`SELECT * FROM lot_links WHERE child_lot_id = ?`, [lotId]);
  return rows as LotLink[];
}

export async function getLotChildren(lotId: string): Promise<LotLink[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync(`SELECT * FROM lot_links WHERE parent_lot_id = ?`, [lotId]);
  return rows as LotLink[];
}

/**
 * Vérifie l'intégrité de la chaîne d'un lot : recalcule chaque hash et
 * confirme qu'il matche celui en base. Retourne le numéro du premier event
 * où la chaîne casse, ou null si tout est ok.
 */
export async function verifyLotChain(lotId: string): Promise<{ ok: boolean; brokenAtSequence: number | null }> {
  const events = await getLotEvents(lotId);
  let prevHash: string | null = null;
  for (const e of events) {
    if (e.prev_hash !== prevHash) {
      return { ok: false, brokenAtSequence: e.sequence };
    }
    const recomputed = await computeEventHash({
      prevHash: e.prev_hash,
      sequence: e.sequence,
      type: e.type,
      actorId: e.actor_id,
      actorMaillon: e.actor_maillon,
      payload: e.payload,
      occurredAt: e.occurred_at,
    });
    if (recomputed !== e.hash) {
      return { ok: false, brokenAtSequence: e.sequence };
    }
    prevHash = e.hash;
  }
  return { ok: true, brokenAtSequence: null };
}
