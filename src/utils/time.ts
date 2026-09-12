import type { AttendanceEntry } from '../types';

export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function todayISO(): string {
  return toISODate(new Date());
}

export function isWeekend(iso: string): boolean {
  const day = new Date(`${iso}T12:00:00`).getDay();
  return day === 0 || day === 6;
}

/** Inclusive count of Mon–Fri days between two ISO dates. */
export function businessDaysBetween(startISO: string, endISO: string): number {
  const start = new Date(`${startISO}T12:00:00`);
  const end = new Date(`${endISO}T12:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  if (end < start) return 0;
  let count = 0;
  const cursor = new Date(start);
  while (cursor <= end) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) count += 1;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

/**
 * Worked minutes for a single attendance row.
 * Open shifts are measured up to `now` so live counters stay honest.
 */
/**
 * Worked seconds for a single attendance row.
 * Open shifts are measured up to `now` so live counters stay honest.
 */
export function workedSeconds(entry: AttendanceEntry, now: Date = new Date()): number {
  const start = new Date(entry.clockIn).getTime();
  const end = entry.clockOut ? new Date(entry.clockOut).getTime() : now.getTime();
  const grossSecs = Math.max(0, Math.floor((end - start) / 1000));
  return Math.max(0, grossSecs - Math.max(0, entry.breakMinutes * 60));
}

export function workedMinutes(entry: AttendanceEntry, now: Date = new Date()): number {
  const start = new Date(entry.clockIn).getTime();
  const end = entry.clockOut ? new Date(entry.clockOut).getTime() : now.getTime();
  const gross = Math.max(0, Math.round((end - start) / 60000));
  return Math.max(0, gross - Math.max(0, entry.breakMinutes));
}

export function sumWorkedMinutes(entries: AttendanceEntry[], now: Date = new Date()): number {
  return entries.reduce((total, entry) => total + workedMinutes(entry, now), 0);
}

export function formatDuration(minutes: number): string {
  const safe = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safe / 60);
  const mins = safe % 60;
  if (hours === 0) return `${mins}m`;
  return `${hours}h ${`${mins}`.padStart(2, '0')}m`;
}

export function formatDurationWithSeconds(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  const hStr = `${hours}`.padStart(2, '0');
  const mStr = `${mins}`.padStart(2, '0');
  const sStr = `${secs}`.padStart(2, '0');
  return `${hStr}h ${mStr}m ${sStr}s`;
}

export function formatHours(minutes: number): string {
  return `${(Math.max(0, minutes) / 60).toFixed(1)}h`;
}

export function formatTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export function formatDate(iso: string): string {
  if (!iso) return '—';
  return new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

export function formatDateTime(iso: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function relativeTime(iso: string, now: Date = new Date()): string {
  const diff = now.getTime() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(iso);
}

/** Monday-anchored start of the week containing `date`. */
export function startOfWeek(date: Date = new Date()): Date {
  const copy = new Date(date);
  const day = (copy.getDay() + 6) % 7;
  copy.setDate(copy.getDate() - day);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function lastNDates(count: number, from: Date = new Date()): string[] {
  const dates: string[] = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(from);
    d.setDate(d.getDate() - i);
    dates.push(toISODate(d));
  }
  return dates;
}

export function datesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}