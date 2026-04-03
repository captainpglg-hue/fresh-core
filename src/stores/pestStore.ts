import { create } from 'zustand';
import { getAllLocal, insertLocal } from '../services/database';
import { differenceInDays } from 'date-fns';
import type { PestControl } from '../types/database';

interface PestCheckpoint {
  id: string;
  name: string;
  checked: boolean;
}

interface PestState {
  controls: PestControl[];
  checkpoints: PestCheckpoint[];
  serviceProvider: { name: string; phone: string; email: string } | null;
  loadData: (establishmentId: string) => Promise<void>;
  addCheckpoint: (name: string) => void;
  removeCheckpoint: (id: string) => void;
  validateCheckpoint: (id: string, establishmentId: string) => Promise<void>;
  reportAnomaly: (data: Partial<PestControl>) => Promise<string>;
  addIntervention: (data: Partial<PestControl>) => Promise<string>;
  getNextVisitDate: () => string | null;
  setServiceProvider: (provider: { name: string; phone: string; email: string }) => void;
}

export const usePestStore = create<PestState>((set, get) => ({
  controls: [],
  checkpoints: [
    { id: '1', name: 'Entrees du batiment', checked: false },
    { id: '2', name: 'Zone de stockage', checked: false },
    { id: '3', name: 'Poubelles exterieures', checked: false },
    { id: '4', name: 'Cuisine - sous equipements', checked: false },
    { id: '5', name: 'Reserve seche', checked: false },
  ],
  serviceProvider: null,

  loadData: async (establishmentId: string) => {
    const controls = await getAllLocal<PestControl>('pest_controls', 'establishment_id = ?', [establishmentId]);
    set({ controls });
  },

  addCheckpoint: (name: string) => {
    const id = Date.now().toString();
    set({ checkpoints: [...get().checkpoints, { id, name, checked: false }] });
  },

  removeCheckpoint: (id: string) => {
    set({ checkpoints: get().checkpoints.filter((c) => c.id !== id) });
  },

  validateCheckpoint: async (id: string, establishmentId: string) => {
    set({
      checkpoints: get().checkpoints.map((c) => (c.id === id ? { ...c, checked: true } : c)),
    });
    const checkpoint = get().checkpoints.find((c) => c.id === id);
    await insertLocal('pest_controls', {
      establishment_id: establishmentId,
      control_type: 'daily_check',
      checkpoint_name: checkpoint?.name || '',
      is_anomaly: false,
      recorded_at: new Date().toISOString(),
    });
  },

  reportAnomaly: async (data) => {
    const id = await insertLocal('pest_controls', {
      ...data,
      control_type: 'pest_sighting',
      is_anomaly: true,
      recorded_at: new Date().toISOString(),
    });
    set({ controls: [...get().controls, { ...data, id } as PestControl] });
    return id;
  },

  addIntervention: async (data) => {
    const id = await insertLocal('pest_controls', {
      ...data,
      control_type: 'intervention_report',
      recorded_at: new Date().toISOString(),
    });
    set({ controls: [...get().controls, { ...data, id } as PestControl] });
    return id;
  },

  getNextVisitDate: () => {
    const interventions = get().controls
      .filter((c) => c.control_type === 'intervention_report' && c.next_visit_date)
      .sort((a, b) => (b.next_visit_date || '').localeCompare(a.next_visit_date || ''));
    return interventions[0]?.next_visit_date || null;
  },

  setServiceProvider: (provider) => set({ serviceProvider: provider }),
}));
