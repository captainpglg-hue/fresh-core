export interface OCRResult {
  value: number;
  confidence: number;
  rawText: string;
}

export interface SyncStats {
  pending: number;
  synced: number;
  error: number;
  total: number;
}

export interface DashboardModule {
  name: string;
  icon: string;
  completed: number;
  total: number;
  hasAlert: boolean;
  alertMessage: string | null;
}

export interface DashboardData {
  greeting: string;
  date: string;
  totalTasks: number;
  completedTasks: number;
  progressPercent: number;
  modules: DashboardModule[];
}
