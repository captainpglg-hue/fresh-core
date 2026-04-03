import { create } from 'zustand';
import { getAllLocal, insertLocal, updateLocal } from '../services/database';
import type { Supplier } from '../types/database';

interface SupplierState {
  suppliers: Supplier[];
  loadSuppliers: (establishmentId: string) => Promise<void>;
  addSupplier: (data: Partial<Supplier>) => Promise<string>;
  updateSupplier: (id: string, data: Partial<Supplier>) => Promise<void>;
  checkSanitaryApproval: (supplierId: string) => 'valid' | 'expiring' | 'expired';
}

export const useSupplierStore = create<SupplierState>((set, get) => ({
  suppliers: [],

  loadSuppliers: async (establishmentId: string) => {
    const suppliers = await getAllLocal<Supplier>('suppliers', 'establishment_id = ? AND is_active = 1', [establishmentId]);
    set({ suppliers });
  },

  addSupplier: async (data) => {
    const id = await insertLocal('suppliers', { ...data, is_active: true });
    const suppliers = [...get().suppliers, { ...data, id, is_active: true } as Supplier];
    set({ suppliers });
    return id;
  },

  updateSupplier: async (id, data) => {
    await updateLocal('suppliers', id, data);
    set({
      suppliers: get().suppliers.map((s) => (s.id === id ? { ...s, ...data } : s)),
    });
  },

  checkSanitaryApproval: (supplierId: string) => {
    const supplier = get().suppliers.find((s) => s.id === supplierId);
    if (!supplier?.sanitary_approval_expiry) return 'valid';
    const expiry = new Date(supplier.sanitary_approval_expiry);
    const now = new Date();
    const daysUntil = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    if (daysUntil < 0) return 'expired';
    if (daysUntil < 30) return 'expiring';
    return 'valid';
  },
}));
