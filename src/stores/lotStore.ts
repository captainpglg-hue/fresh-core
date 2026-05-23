import { create } from 'zustand';
import {
  createLot as svcCreateLot,
  appendEvent as svcAppendEvent,
  getLotByCode,
  getLotById,
  getLotEvents,
  getLotParents,
  verifyLotChain,
  type CreateLotInput,
  type AppendEventInput,
} from '../services/lotChain';
import { getAllLocal } from '../services/database';
import type { Lot, LotEvent, LotLink } from '../types/lotChain';

interface LotState {
  lots: Lot[];
  loading: boolean;
}

interface LotActions {
  loadHeldByUser: (userId: string) => Promise<void>;
  loadByEstablishment: (establishmentId: string) => Promise<void>;
  createLot: (input: CreateLotInput) => Promise<Lot>;
  appendEvent: (input: AppendEventInput) => Promise<LotEvent>;
  fetchByCode: (lotCode: string) => Promise<Lot | null>;
  fetchById: (lotId: string) => Promise<Lot | null>;
  fetchEvents: (lotId: string) => Promise<LotEvent[]>;
  fetchParents: (lotId: string) => Promise<LotLink[]>;
  verify: (lotId: string) => Promise<{ ok: boolean; brokenAtSequence: number | null }>;
}

export const useLotStore = create<LotState & LotActions>()((set) => ({
  lots: [],
  loading: false,

  loadHeldByUser: async (userId: string) => {
    set({ loading: true });
    try {
      const rows = await getAllLocal<Lot>(
        'lots',
        'current_holder_id = ? AND status = ?',
        [userId, 'active']
      );
      set({ lots: rows });
    } finally {
      set({ loading: false });
    }
  },

  loadByEstablishment: async (establishmentId: string) => {
    set({ loading: true });
    try {
      const rows = await getAllLocal<Lot>(
        'lots',
        'current_establishment_id = ?',
        [establishmentId]
      );
      set({ lots: rows });
    } finally {
      set({ loading: false });
    }
  },

  createLot: async (input) => {
    const lot = await svcCreateLot(input);
    set((s) => ({ lots: [lot, ...s.lots] }));
    return lot;
  },

  appendEvent: async (input) => {
    return svcAppendEvent(input);
  },

  fetchByCode: (lotCode) => getLotByCode(lotCode),
  fetchById: (lotId) => getLotById(lotId),
  fetchEvents: (lotId) => getLotEvents(lotId),
  fetchParents: (lotId) => getLotParents(lotId),
  verify: (lotId) => verifyLotChain(lotId),
}));
