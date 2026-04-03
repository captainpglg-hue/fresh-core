import { create } from 'zustand';
import { getAllLocal, insertLocal, updateLocal } from '../services/database';
import { DLC_RULES } from '../constants/dlcRules';
import { addDays, format, differenceInDays } from 'date-fns';
import type { ProductInStock } from '../types/database';

interface TraceabilityState {
  productsInStock: ProductInStock[];
  dlcAlerts: ProductInStock[];
  loadProducts: (establishmentId: string) => Promise<void>;
  addProduct: (data: Partial<ProductInStock>) => Promise<string>;
  openProduct: (id: string) => Promise<void>;
  destroyProduct: (id: string, reason: string, photoUri?: string) => Promise<void>;
  getAlerts: () => { expiringSoon: ProductInStock[]; expired: ProductInStock[] };
}

export const useTraceabilityStore = create<TraceabilityState>((set, get) => ({
  productsInStock: [],
  dlcAlerts: [],

  loadProducts: async (establishmentId: string) => {
    const products = await getAllLocal<ProductInStock>(
      'products_in_stock',
      "establishment_id = ? AND status IN ('in_stock', 'opened')",
      [establishmentId]
    );
    set({ productsInStock: products });
  },

  addProduct: async (data) => {
    const id = await insertLocal('products_in_stock', { ...data, status: 'in_stock' });
    set({ productsInStock: [...get().productsInStock, { ...data, id, status: 'in_stock' } as ProductInStock] });
    return id;
  },

  openProduct: async (id: string) => {
    const product = get().productsInStock.find((p) => p.id === id);
    if (!product) return;

    const category = product.category || 'opened_default';
    const daysToAdd = DLC_RULES[category] || DLC_RULES.opened_default;
    const dlcSecondary = format(addDays(new Date(), daysToAdd), 'yyyy-MM-dd');

    await updateLocal('products_in_stock', id, {
      status: 'opened',
      opened_at: new Date().toISOString(),
      dlc_secondary: dlcSecondary,
    });
    set({
      productsInStock: get().productsInStock.map((p) =>
        p.id === id ? { ...p, status: 'opened' as const, opened_at: new Date().toISOString(), dlc_secondary: dlcSecondary } : p
      ),
    });
  },

  destroyProduct: async (id: string, reason: string, photoUri?: string) => {
    await updateLocal('products_in_stock', id, {
      status: 'destroyed',
      destruction_reason: reason,
      destruction_photo_path: photoUri || null,
      destroyed_at: new Date().toISOString(),
    });
    set({
      productsInStock: get().productsInStock.filter((p) => p.id !== id),
    });
  },

  getAlerts: () => {
    const today = new Date();
    const products = get().productsInStock;

    const expired = products.filter((p) => {
      const dlc = p.dlc_secondary || p.dlc_primary;
      if (!dlc) return false;
      return differenceInDays(new Date(dlc), today) < 0;
    });

    const expiringSoon = products.filter((p) => {
      const dlc = p.dlc_secondary || p.dlc_primary;
      if (!dlc) return false;
      const days = differenceInDays(new Date(dlc), today);
      return days >= 0 && days <= 3;
    });

    return { expiringSoon, expired };
  },
}));
