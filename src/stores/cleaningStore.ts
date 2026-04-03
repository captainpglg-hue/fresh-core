import { create } from 'zustand';
import { getAllLocal, insertLocal } from '../services/database';
import type { CleaningTask, CleaningRecord } from '../types/database';

const DEFAULT_TASKS = [
  { zone: 'kitchen', zone_name: 'Plans de travail', frequency: 'per_service' as const },
  { zone: 'cooking', zone_name: 'Equipements de cuisson', frequency: 'daily' as const },
  { zone: 'cold_storage', zone_name: 'Chambres froides', frequency: 'weekly' as const },
  { zone: 'sanitary', zone_name: 'Sanitaires', frequency: 'daily' as const },
  { zone: 'floors', zone_name: 'Sols', frequency: 'per_service' as const },
  { zone: 'dining', zone_name: 'Salle', frequency: 'per_service' as const },
];

interface CleaningState {
  tasks: CleaningTask[];
  todayRecords: CleaningRecord[];
  initDefaultTasks: (establishmentId: string) => Promise<void>;
  loadTodayTasks: (establishmentId: string) => Promise<void>;
  validateTask: (taskId: string, establishmentId: string, data: { cleaning_product?: string; dosage?: string; contact_time_minutes?: number; photo_path?: string }) => Promise<void>;
  getOverdueTasks: () => CleaningTask[];
}

export const useCleaningStore = create<CleaningState>((set, get) => ({
  tasks: [],
  todayRecords: [],

  initDefaultTasks: async (establishmentId: string) => {
    const existing = await getAllLocal<CleaningTask>('cleaning_tasks', 'establishment_id = ?', [establishmentId]);
    if (existing.length === 0) {
      for (const task of DEFAULT_TASKS) {
        await insertLocal('cleaning_tasks', { ...task, establishment_id: establishmentId, is_active: true });
      }
    }
    await get().loadTodayTasks(establishmentId);
  },

  loadTodayTasks: async (establishmentId: string) => {
    const tasks = await getAllLocal<CleaningTask>('cleaning_tasks', 'establishment_id = ? AND is_active = 1', [establishmentId]);
    const today = new Date().toISOString().split('T')[0];
    const todayRecords = await getAllLocal<CleaningRecord>(
      'cleaning_records',
      'establishment_id = ? AND date(validated_at) = ?',
      [establishmentId, today]
    );
    set({ tasks, todayRecords });
  },

  validateTask: async (taskId, establishmentId, data) => {
    await insertLocal('cleaning_records', {
      task_id: taskId,
      establishment_id: establishmentId,
      ...data,
      validated_at: new Date().toISOString(),
    });
    const todayRecords = [...get().todayRecords, { task_id: taskId, establishment_id: establishmentId, ...data, validated_at: new Date().toISOString() } as CleaningRecord];
    set({ todayRecords });
  },

  getOverdueTasks: () => {
    const { tasks, todayRecords } = get();
    const completedTaskIds = new Set(todayRecords.map((r) => r.task_id));
    return tasks.filter((t) => !completedTaskIds.has(t.id) && (t.frequency === 'daily' || t.frequency === 'per_service'));
  },
}));
