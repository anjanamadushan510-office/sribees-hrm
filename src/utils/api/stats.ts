import type { AttendanceEntry, LeaveBalance, LeaveRequest, Profile, Session } from '../../types';
import { isAdmin, requireAdmin, requireSession } from '../policies';
import { getDb, sleep } from '../store';
import { lastNDates, startOfWeek, sumWorkedMinutes, toISODate, todayISO, workedMinutes } from '../time';
import { computeBalances } from './leave';

export interface TrendPoint {
  date: string;
  label: string;
  hours: number;
}

export interface AdminStats {
  headcount: number;
  activeToday: number;
  remoteToday: number;
  onLeaveToday: number;
  pendingLeave: number;
  pendingInvites: number;
  avgHoursThisWeek: number;
  attendanceRate: number;
  trend: TrendPoint[];
  departmentSplit: Array<{department: string;count: number;}>;
  pendingQueue: Array<{request: LeaveRequest;employeeName: string;}>;
}

export interface EmployeeStats {
  openShift: AttendanceEntry | null;
  todayMinutes: number;
  weekMinutes: number;
  weekTarget: number;
  monthMinutes: number;
  balances: LeaveBalance[];
  upcomingLeave: LeaveRequest[];
  pendingLeave: number;
  trend: TrendPoint[];
  teammatesWorking: number;
}

const WEEK_TARGET_MINUTES = 40 * 60;

function label(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short' });
}

export async function getAdminStats(session: Session | null): Promise<AdminStats> {
  requireAdmin(session);
  await sleep(320);
  const db = getDb();
  const today = todayISO();
  const active = db.profiles.filter((p) => p.status === 'active');

  const todaysEntries = db.attendance.filter((e) => e.date === today);
  const onLeaveToday = db.leaveRequests.filter(
    (r) => r.status === 'approved' && r.startDate <= today && r.endDate >= today
  );
  const weekStart = toISODate(startOfWeek());
  const weekEntries = db.attendance.filter((e) => e.date >= weekStart);

  const trend: TrendPoint[] = lastNDates(14).map((date) => ({
    date,
    label: label(date),
    hours: Number((sumWorkedMinutes(db.attendance.filter((e) => e.date === date)) / 60).toFixed(1))
  }));

  const departments = new Map<string, number>();
  active.forEach((p) => departments.set(p.department, (departments.get(p.department) ?? 0) + 1));

  const expectedToday = Math.max(1, active.length - onLeaveToday.length);
  const pendingQueue = db.leaveRequests.
  filter((r) => r.status === 'pending').
  sort((a, b) => a.startDate.localeCompare(b.startDate)).
  slice(0, 5).
  map((request) => ({
    request,
    employeeName: db.profiles.find((p) => p.id === request.employeeId)?.fullName ?? 'Former employee'
  }));

  return {
    headcount: active.length,
    activeToday: new Set(todaysEntries.map((e) => e.employeeId)).size,
    remoteToday: db.presence.filter((p) => p.status === 'working' && p.workMode === 'remote').length,
    onLeaveToday: onLeaveToday.length,
    pendingLeave: db.leaveRequests.filter((r) => r.status === 'pending').length,
    pendingInvites: db.invitations.filter((i) => i.status === 'pending').length,
    avgHoursThisWeek: Number((sumWorkedMinutes(weekEntries) / 60 / Math.max(1, active.length)).toFixed(1)),
    attendanceRate: Math.round(new Set(todaysEntries.map((e) => e.employeeId)).size / expectedToday * 100),
    trend,
    departmentSplit: Array.from(departments, ([department, count]) => ({ department, count })).sort(
      (a, b) => b.count - a.count
    ),
    pendingQueue
  };
}

export async function getEmployeeStats(session: Session | null): Promise<EmployeeStats> {
  const active = requireSession(session);
  await sleep(320);
  const db = getDb();
  const today = todayISO();
  const weekStart = toISODate(startOfWeek());
  const monthStart = `${today.slice(0, 7)}-01`;

  const mine = db.attendance.filter((e) => e.employeeId === active.userId);
  const openShift = mine.find((e) => !e.clockOut) ?? null;

  const trend: TrendPoint[] = lastNDates(14).map((date) => {
    const entries = mine.filter((e) => e.date === date);
    return { date, label: label(date), hours: Number((sumWorkedMinutes(entries) / 60).toFixed(1)) };
  });

  const myLeave = db.leaveRequests.filter((r) => r.employeeId === active.userId);

  return {
    openShift,
    todayMinutes: mine.filter((e) => e.date === today).reduce((s, e) => s + workedMinutes(e), 0),
    weekMinutes: sumWorkedMinutes(mine.filter((e) => e.date >= weekStart)),
    weekTarget: WEEK_TARGET_MINUTES,
    monthMinutes: sumWorkedMinutes(mine.filter((e) => e.date >= monthStart)),
    balances: computeBalances(active.userId),
    upcomingLeave: myLeave.
    filter((r) => r.status === 'approved' && r.endDate >= today).
    sort((a, b) => a.startDate.localeCompare(b.startDate)).
    slice(0, 3),
    pendingLeave: myLeave.filter((r) => r.status === 'pending').length,
    trend,
    teammatesWorking: db.presence.filter((p) => p.status === 'working' && p.employeeId !== active.userId).length
  };
}

/** Small helper the directory and profile pages share. */
export function summarizeAttendance(entries: AttendanceEntry[]): {days: number;minutes: number;avg: number;} {
  const minutes = sumWorkedMinutes(entries);
  const days = entries.length;
  return { days, minutes, avg: days === 0 ? 0 : Math.round(minutes / days) };
}

export function canViewAudit(session: Session | null, profile: Profile | null): boolean {
  return isAdmin(session) && profile?.role === 'admin';
}