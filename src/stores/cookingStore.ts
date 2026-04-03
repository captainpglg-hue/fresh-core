import { create } from 'zustand';
import { insertLocal, getAllLocal } from '../services/database';
import type { TemperatureReading } from '../types/database';

interface CoolingTimer {
  id: string;
  equipmentId: string;
  startedAt: string;
  checkpoints: { time: string; temperature: number; photoUri?: string }[];
  status: 'active' | 'completed' | 'failed';
}

interface CookingState {
  cookingRecords: TemperatureReading[];
  activeTimers: CoolingTimer[];
  addCookingRecord: (data: Partial<TemperatureReading>) => Promise<string>;
  startCoolingTimer: (equipmentId: string) => string;
  addCoolingCheckpoint: (timerId: string, temp: number, photoUri?: string) => void;
  getCoolingTimerStatus: (timerId: string) => CoolingTimer | undefined;
  loadRecords: (establishmentId: string) => Promise<void>;
}

export const useCookingStore = create<CookingState>((set, get) => ({
  cookingRecords: [],
  activeTimers: [],

  loadRecords: async (establishmentId: string) => {
    const today = new Date().toISOString().split('T')[0];
    const records = await getAllLocal<TemperatureReading>(
      'temperature_readings',
      "establishment_id = ? AND reading_type IN ('cooking_core','cooling','reheating') AND date(recorded_at) = ?",
      [establishmentId, today]
    );
    set({ cookingRecords: records });
  },

  addCookingRecord: async (data) => {
    const id = await insertLocal('temperature_readings', {
      ...data,
      recorded_at: new Date().toISOString(),
    });
    set({ cookingRecords: [...get().cookingRecords, { ...data, id } as TemperatureReading] });
    return id;
  },

  startCoolingTimer: (equipmentId: string) => {
    const id = Date.now().toString();
    const timer: CoolingTimer = {
      id,
      equipmentId,
      startedAt: new Date().toISOString(),
      checkpoints: [],
      status: 'active',
    };
    set({ activeTimers: [...get().activeTimers, timer] });
    return id;
  },

  addCoolingCheckpoint: (timerId: string, temp: number, photoUri?: string) => {
    set({
      activeTimers: get().activeTimers.map((t) => {
        if (t.id !== timerId) return t;
        const checkpoints = [...t.checkpoints, { time: new Date().toISOString(), temperature: temp, photoUri }];
        const isComplete = checkpoints.length >= 3;
        const isFailed = isComplete && temp > 10;
        return { ...t, checkpoints, status: isFailed ? 'failed' : isComplete ? 'completed' : 'active' };
      }),
    });
  },

  getCoolingTimerStatus: (timerId: string) => {
    return get().activeTimers.find((t) => t.id === timerId);
  },
}));
