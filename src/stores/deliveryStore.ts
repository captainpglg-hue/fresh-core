import { create } from 'zustand';
import { getAllLocal, insertLocal, updateLocal } from '../services/database';
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

    const deliveryId = await insertLocal('deliveries', {
      ...currentDelivery,
      status: 'accepted',
      recorded_at: new Date().toISOString(),
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

    const deliveryId = await insertLocal('deliveries', {
      ...currentDelivery,
      status: 'refused',
      refusal_reason: reason,
      refusal_photo_path: photoUri || null,
      recorded_at: new Date().toISOString(),
    });

    set({ currentDelivery: null, currentItems: [] });
    return deliveryId;
  },
}));
