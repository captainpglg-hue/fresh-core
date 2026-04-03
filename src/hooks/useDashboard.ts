import { useTemperatureStore } from '../stores/temperatureStore';
import { useCleaningStore } from '../stores/cleaningStore';
import { useTraceabilityStore } from '../stores/traceabilityStore';
import { useCookingStore } from '../stores/cookingStore';
import { useOilStore } from '../stores/oilStore';
import { usePestStore } from '../stores/pestStore';
import { useAuthStore } from '../stores/authStore';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { DashboardData, DashboardModule } from '../types/api';

export function useDashboard(): DashboardData {
  const { user } = useAuthStore();
  const tempStore = useTemperatureStore();
  const cleaningStore = useCleaningStore();
  const traceStore = useTraceabilityStore();
  const cookingStore = useCookingStore();
  const oilStore = useOilStore();
  const pestStore = usePestStore();

  const firstName = user?.full_name?.split(' ')[0] || 'Utilisateur';
  const today = format(new Date(), 'EEEE d MMMM yyyy', { locale: fr });

  const tempStats = tempStore.getTodayStats();
  const completedCleaningIds = new Set(cleaningStore.todayRecords.map((r) => r.task_id));
  const overdueTasks = cleaningStore.getOverdueTasks();
  const { expiringSoon, expired } = traceStore.getAlerts();
  const allCheckpointsChecked = pestStore.checkpoints.every((c) => c.checked);
  const checkedCount = pestStore.checkpoints.filter((c) => c.checked).length;

  const modules: DashboardModule[] = [
    {
      name: 'Temperatures',
      icon: 'thermometer',
      completed: tempStats.compliant,
      total: tempStats.total,
      hasAlert: tempStats.nonCompliant > 0,
      alertMessage: tempStats.nonCompliant > 0 ? `${tempStats.nonCompliant} hors seuil` : null,
    },
    {
      name: 'Receptions',
      icon: 'truck',
      completed: 0,
      total: 0,
      hasAlert: false,
      alertMessage: null,
    },
    {
      name: 'Nettoyage',
      icon: 'spray-can',
      completed: completedCleaningIds.size,
      total: cleaningStore.tasks.length,
      hasAlert: overdueTasks.length > 0,
      alertMessage: overdueTasks.length > 0 ? `${overdueTasks.length} en retard` : null,
    },
    {
      name: 'Cuisson',
      icon: 'flame',
      completed: cookingStore.cookingRecords.length,
      total: cookingStore.cookingRecords.length || 0,
      hasAlert: false,
      alertMessage: null,
    },
    {
      name: 'Tracabilite DLC',
      icon: 'tag',
      completed: traceStore.productsInStock.length,
      total: traceStore.productsInStock.length,
      hasAlert: expired.length > 0 || expiringSoon.length > 0,
      alertMessage: expired.length > 0 ? `${expired.length} expire(s)` : expiringSoon.length > 0 ? `${expiringSoon.length} bientot` : null,
    },
    {
      name: 'Huiles',
      icon: 'droplet',
      completed: oilStore.fryers.length > 0 ? oilStore.controls.length : 0,
      total: oilStore.fryers.length,
      hasAlert: false,
      alertMessage: null,
    },
    {
      name: 'Nuisibles',
      icon: 'bug',
      completed: checkedCount,
      total: pestStore.checkpoints.length,
      hasAlert: !allCheckpointsChecked,
      alertMessage: !allCheckpointsChecked ? 'Controle incomplet' : null,
    },
  ];

  const totalTasks = modules.reduce((sum, m) => sum + m.total, 0);
  const completedTasks = modules.reduce((sum, m) => sum + m.completed, 0);
  const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return {
    greeting: `Bonjour ${firstName}`,
    date: today,
    totalTasks,
    completedTasks,
    progressPercent,
    modules,
  };
}
