import { create } from 'zustand';
import { getAllLocal, insertLocal } from '../services/database';
import type { CleaningTask, CleaningRecord } from '../types/database';

// Liste alignée sur le seed démo (src/services/demoData.ts) : 8 tâches
// couvrant les zones réglementaires HACCP les plus courantes. La même
// liste sert de base pour la démo et pour tout nouvel établissement créé
// hors démo, afin que l'UI dashboard (Nettoyage → "X/Y tâches") affiche
// toujours le même dénominateur quel que soit le mode.
const DEFAULT_TASKS = [
  { zone: 'cuisine', zone_name: 'Plans de travail', frequency: 'per_service' as const },
  { zone: 'cuisine', zone_name: 'Équipements de cuisson', frequency: 'per_service' as const },
  { zone: 'cuisine', zone_name: 'Sols cuisine', frequency: 'per_service' as const },
  { zone: 'stockage', zone_name: 'Chambres froides', frequency: 'weekly' as const },
  { zone: 'sanitaires', zone_name: 'Sanitaires', frequency: 'daily' as const },
  { zone: 'cuisine', zone_name: 'Poubelles', frequency: 'daily' as const },
  { zone: 'salle', zone_name: 'Tables et chaises', frequency: 'per_service' as const },
  { zone: 'stockage', zone_name: 'Réserve sèche', frequency: 'weekly' as const },
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
