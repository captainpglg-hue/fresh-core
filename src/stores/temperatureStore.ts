import { create } from 'zustand';
import * as Crypto from 'expo-crypto';
import { insertLocal, getAllLocal } from '../services/database';
import { isCompliant, THRESHOLDS } from '../constants/thresholds';
import type { TemperatureReading, Equipment } from '../types/database';

interface TemperatureState {
  readings: TemperatureReading[];
  equipment: Equipment[];
}

interface TemperatureActions {
  loadEquipment: (establishmentId: string) => Promise<void>;
  addEquipment: (data: Omit<Equipment, 'id' | 'created_at'>) => Promise<Equipment>;
  addReading: (data: Omit<TemperatureReading, 'id' | 'created_at' | 'local_id' | 'synced_at' | 'blockchain_hash'>) => Promise<TemperatureReading>;
  getReadingsForDate: (date: string) => Promise<TemperatureReading[]>;
  getTodayStats: () => { total: number; compliant: number; nonCompliant: number; complianceRate: number };
}

export const useTemperatureStore = create<TemperatureState & TemperatureActions>()(
  (set, get) => ({
    readings: [],
    equipment: [],

    loadEquipment: async (establishmentId: string) => {
      const rows = await getAllLocal<Equipment>(
        'equipment',
        'establishment_id = ? AND is_active = ?',
        [establishmentId, 1]
      );
      set({ equipment: rows });
    },

    addEquipment: async (data) => {
      const id = Crypto.randomUUID();
      const newEquipment: Equipment = {
        ...data,
        id,
        created_at: new Date().toISOString(),
      };
      await insertLocal('equipment', newEquipment as unknown as Record<string, unknown>);
      set((state) => ({ equipment: [...state.equipment, newEquipment] }));
      return newEquipment;
    },

    addReading: async (data) => {
      const id = Crypto.randomUUID();
      const localId = Crypto.randomUUID();

      const equipmentType = get().equipment.find(
        (e) => e.id === data.equipment_id
      )?.type;

      const compliant = equipmentType
        ? isCompliant(data.temperature_value, equipmentType)
        : data.is_compliant;

      const threshold = equipmentType ? THRESHOLDS[equipmentType] : undefined;

      const newReading: TemperatureReading = {
        ...data,
        id,
        local_id: localId,
        is_compliant: compliant,
        threshold_min: threshold?.min ?? data.threshold_min,
        threshold_max: threshold?.max ?? data.threshold_max,
        synced_at: null,
        blockchain_hash: null,
        created_at: new Date().toISOString(),
      };

      await insertLocal('temperature_readings', newReading as unknown as Record<string, unknown>);
      set((state) => ({ readings: [...state.readings, newReading] }));

      if (!compliant) {
        // Trigger notification for non-compliant reading
        try {
          const Notifications = await import('expo-notifications');
          await Notifications.scheduleNotificationAsync({
            content: {
              title: 'Alerte temperature',
              body: `Temperature non conforme : ${data.temperature_value}°C (${equipmentType ?? 'inconnu'})`,
              data: { readingId: id },
            },
            trigger: null,
          });
        } catch {
          // Notifications may not be available in all environments
        }
      }

      return newReading;
    },

    getReadingsForDate: async (date: string) => {
      const allReadings = await getAllLocal<TemperatureReading>('temperature_readings');
      const filtered = allReadings.filter((r) =>
        r.recorded_at.startsWith(date)
      );
      set({ readings: filtered });
      return filtered;
    },

    getTodayStats: () => {
      const { readings } = get();
      const total = readings.length;
      const compliant = readings.filter((r) => r.is_compliant).length;
      const nonCompliant = total - compliant;
      const complianceRate = total > 0 ? Math.round((compliant / total) * 100) : 100;
      return { total, compliant, nonCompliant, complianceRate };
    },
  })
);
