import { format, differenceInDays, addDays, isAfter, isBefore, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

export function formatDateFR(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'dd/MM/yyyy', { locale: fr });
}

export function formatDateTimeFR(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'dd/MM/yyyy HH:mm', { locale: fr });
}

export function formatRelativeDate(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  const days = differenceInDays(d, new Date());
  if (days === 0) return "Aujourd'hui";
  if (days === 1) return 'Demain';
  if (days === -1) return 'Hier';
  if (days > 0) return `Dans ${days} jours`;
  return `Il y a ${Math.abs(days)} jours`;
}

export function getDLCStatus(dlcDate: string): 'ok' | 'warning' | 'danger' | 'expired' {
  const days = differenceInDays(parseISO(dlcDate), new Date());
  if (days < 0) return 'expired';
  if (days <= 1) return 'danger';
  if (days <= 3) return 'warning';
  return 'ok';
}

export { format, differenceInDays, addDays, isAfter, isBefore, parseISO };
