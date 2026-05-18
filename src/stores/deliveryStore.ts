import { create } from 'zustand';
import { getAllLocal, insertLocal } from '../services/database';
import { computeChainHash, GENESIS_HASH } from '../utils/hashChain';
import type { Delivery, DeliveryItem } from '../types/database';

interface DeliveryState {
  deliveries: Delivery[];
  currentDelivery: Partial<Delivery> | null;
  currentItems: Partial<DeliveryItem>[];
  loadDeliveries: (establishmentId: string, date?: string) => Promise<void>;
  startDelivery: (supplierId: string, establishmentId: string) => void;
  addItem: (item: Partial<DeliveryItem>) => void;
  removeItem: (index: number) => void;
  validateDelivery: () => Promise<string>;
  refuseDelivery: (reason: string, photoUri?: string) => Promise<string>;
}

/**
 * Pull the most recent delivery's blockchain_hash for the given
 * establishment so the next entry can chain onto it. Returns the
 * GENESIS_HASH if no prior delivery exists.
 */
async function getLastChainHash(establishmentId: string): Promise<string> {
  const all = await getAllLocal<Delivery>(
    'deliveries',
    'establishment_id = ? AND blockchain_hash IS NOT NULL',
    [establishmentId],
  );
  if (all.length === 0) return GENESIS_HASH;
  all.sort((a, b) => b.recorded_at.localeCompare(a.recorded_at));
  return all[0].blockchain_hash || GENESIS_HASH;
}

export const useDeliveryStore = create<DeliveryState>((set, get) => ({
  deliveries: [],
  currentDelivery: null,
  currentItems: [],

  loadDeliveries: async (establishmentId: string, date?: string) => {
    const where = date
      ? 'establishment_id = ? AND delivery_date = ?'
      : 'establishment_id = ?';
    const params = date ? [establishmentId, date] : [establishmentId];
    const deliveries = await getAllLocal<Delivery>('deliveries', where, params);
    set({ deliveries });
  },

  startDelivery: (supplierId: string, establishmentId: string) => {
    set({
      currentDelivery: {
        supplier_id: supplierId,
        establishment_id: establishmentId,
        delivery_date: new Date().toISOString().split('T')[0],
        status: 'pending',
      },
      currentItems: [],
    });
  },

  addItem: (item) => {
    set({ currentItems: [...get().currentItems, item] });
  },

  removeItem: (index) => {
    set({ currentItems: get().currentItems.filter((_, i) => i !== index) });
  },

  validateDelivery: async () => {
    const { currentDelivery, currentItems } = get();
    if (!currentDelivery) throw new Error('No delivery in progress');

    const recordedAt = new Date().toISOString();
    const prevHash = currentDelivery.establishment_id
      ? await getLastChainHash(currentDelivery.establishment_id)
      : GENESIS_HASH;

    // Hash the immutable facts of this reception: supplier, date, and a
    // canonical fingerprint of every item line. Editing the row later
    // would not regenerate the same hash → tampering is detectable.
    const chainPayload = {
      supplier_id: currentDelivery.supplier_id ?? null,
      establishment_id: currentDelivery.establishment_id,
      delivery_date: currentDelivery.delivery_date,
      recorded_at: recordedAt,
      items: currentItems.map((it) => ({
        product_name: it.product_name ?? null,
        category: it.category ?? null,
        temperature: it.temperature ?? null,
        dlc: it.dlc ?? null,
        lot_number: it.lot_number ?? null,
        photo_paths: it.photo_paths ?? null,
      })),
    };
    const chainHash = await computeChainHash(prevHash, chainPayload);

    const deliveryId = await insertLocal('deliveries', {
      ...currentDelivery,
      status: 'accepted',
      recorded_at: recordedAt,
      blockchain_hash: chainHash,
    });

    for (const item of currentItems) {
      await insertLocal('delivery_items', {
        ...item,
        delivery_id: deliveryId,
      });
    }

    set({ currentDelivery: null, currentItems: [] });
    return deliveryId;
  },

  refuseDelivery: async (reason, photoUri) => {
    const { currentDelivery } = get();
    if (!currentDelivery) throw new Error('No delivery in progress');

    const recordedAt = new Date().toISOString();
    const prevHash = currentDelivery.establishment_id
      ? await getLastChainHash(currentDelivery.establishment_id)
      : GENESIS_HASH;
    const chainHash = await computeChainHash(prevHash, {
      supplier_id: currentDelivery.supplier_id ?? null,
      establishment_id: currentDelivery.establishment_id,
      delivery_date: currentDelivery.delivery_date,
      recorded_at: recordedAt,
      status: 'refused',
      refusal_reason: reason,
    });

    const deliveryId = await insertLocal('deliveries', {
      ...currentDelivery,
      status: 'refused',
      refusal_reason: reason,
      refusal_photo_path: photoUri || null,
      recorded_at: recordedAt,
      blockchain_hash: chainHash,
    });

    set({ currentDelivery: null, currentItems: [] });
    return deliveryId;
  },
}));
