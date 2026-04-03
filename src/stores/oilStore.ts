import { create } from 'zustand';
import { getAllLocal, insertLocal } from '../services/database';
import { isCompliant } from '../constants/thresholds';
import type { OilControl, Equipment } from '../types/database';

interface OilState {
  controls: OilControl[];
  fryers: Equipment[];
  loadData: (establishmentId: string) => Promise<void>;
  addControl: (data: Partial<OilControl>) => Promise<string>;
  getControlsForEquipment: (equipmentId: string) => OilControl[];
  getLastControl: (equipmentId: string, type: string) => OilControl | undefined;
}

export const useOilStore = create<OilState>((set, get) => ({
  controls: [],
  fryers: [],

  loadData: async (establishmentId: string) => {
    const fryers = await getAllLocal<Equipment>('equipment', "establishment_id = ? AND type = 'fryer' AND is_active = 1", [establishmentId]);
    const controls = await getAllLocal<OilControl>('oil_controls', 'establishment_id = ?', [establishmentId]);
    set({ fryers, controls });
  },

  addControl: async (data) => {
    const record: Partial<OilControl> = {
      ...data,
      recorded_at: new Date().toISOString(),
    };
    if (data.control_type === 'tpm_test' && data.tpm_value != null) {
      record.tpm_compliant = isCompliant(data.tpm_value, 'oil_tpm');
    }
    const id = await insertLocal('oil_controls', record);
    set({ controls: [...get().controls, { ...record, id } as OilControl] });
    return id;
  },

  getControlsForEquipment: (equipmentId: string) => {
    return get().controls
      .filter((c) => c.equipment_id === equipmentId)
      .sort((a, b) => b.recorded_at.localeCompare(a.recorded_at));
  },

  getLastControl: (equipmentId: string, type: string) => {
    return get().controls
      .filter((c) => c.equipment_id === equipmentId && c.control_type === type)
      .sort((a, b) => b.recorded_at.localeCompare(a.recorded_at))[0];
  },
}));
