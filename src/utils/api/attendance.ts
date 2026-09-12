import type { AttendanceEntry, Presence, Profile, Session, WorkMode } from '../../types';
import {
  ConflictError,
  NotFoundError,
  ValidationError,
  requireAdmin,
  requireSelfOrAdmin,
  requireSession } from
'../policies';
import { getDb, mutate, nowIso, sleep, uid } from '../store';
import { todayISO, workedMinutes } from '../time';
import { recordAudit } from './audit';

export interface AttendanceRange {
  employeeId: string;
  from?: string;
  to?: string;
}

export async function listAttendance(session: Session | null, range: AttendanceRange): Promise<AttendanceEntry[]> {
  requireSelfOrAdmin(session, range.employeeId);
  await sleep();
  return getDb().
  attendance.filter((entry) => entry.employeeId === range.employeeId).
  filter((entry) => range.from ? entry.date >= range.from : true).
  filter((entry) => range.to ? entry.date <= range.to : true).
  sort((a, b) => b.date.localeCompare(a.date));
}

export async function getOpenShift(session: Session | null, employeeId: string): Promise<AttendanceEntry | null> {
  requireSelfOrAdmin(session, employeeId);
  await sleep(160);
  return (
    getDb().attendance.find((entry) => entry.employeeId === employeeId && entry.date === todayISO() && !entry.clockOut) ??
    null);

}

export async function clockIn(session: Session | null, workMode: WorkMode): Promise<AttendanceEntry> {
  const active = requireSession(session);
  if (!['office', 'remote', 'hybrid'].includes(workMode)) {
    throw new ValidationError({ workMode: 'Choose where you are working from.' });
  }
  await sleep(300);

  return mutate((db) => {
    const today = todayISO();
    const open = db.attendance.find((e) => e.employeeId === active.userId && !e.clockOut);
    if (open) throw new ConflictError('You are already clocked in.');

    const onLeave = db.leaveRequests.some(
      (r) => r.employeeId === active.userId && r.status === 'approved' && r.startDate <= today && r.endDate >= today
    );
    if (onLeave) throw new ConflictError('You are on approved leave today, so you cannot clock in.');

    const entry: AttendanceEntry = {
      id: uid('att'),
      employeeId: active.userId,
      date: today,
      clockIn: nowIso(),
      clockOut: null,
      breakMinutes: 0,
      workMode,
      note: ''
    };
    db.attendance.push(entry);
    upsertPresence(db.presence, active.userId, 'working', workMode);
    recordAudit(db, active, 'attendance.clock_in', 'attendance', entry.id, { workMode });
    return entry;
  });
}

export async function clockOut(session: Session | null, breakMinutes: number, note: string): Promise<AttendanceEntry> {
  const active = requireSession(session);
  const errors: Record<string, string> = {};
  if (!Number.isFinite(breakMinutes) || breakMinutes < 0) errors.breakMinutes = 'Break minutes cannot be negative.';
  if (breakMinutes > 480) errors.breakMinutes = 'Break minutes look too high.';
  if (note.length > 280) errors.note = 'Keep the note under 280 characters.';
  if (Object.keys(errors).length > 0) throw new ValidationError(errors);
  await sleep(300);

  return mutate((db) => {
    const entry = db.attendance.find((e) => e.employeeId === active.userId && !e.clockOut);
    if (!entry) throw new ConflictError('You are not currently clocked in.');

    const grossMinutes = Math.round((Date.now() - new Date(entry.clockIn).getTime()) / 60000);
    if (breakMinutes >= grossMinutes) {
      throw new ValidationError({ breakMinutes: 'Break cannot be longer than the shift itself.' });
    }
    entry.clockOut = nowIso();
    entry.breakMinutes = Math.round(breakMinutes);
    entry.note = note.trim();

    const presence = db.presence.find((p) => p.employeeId === active.userId);
    upsertPresence(db.presence, active.userId, 'off_shift', presence?.workMode ?? entry.workMode);
    recordAudit(db, active, 'attendance.clock_out', 'attendance', entry.id, {
      minutes: workedMinutes(entry),
      breakMinutes: entry.breakMinutes
    });
    return entry;
  });
}

export async function setPresence(session: Session | null, status: Presence['status']): Promise<Presence> {
  const active = requireSession(session);
  if (!['working', 'on_break', 'off_shift', 'on_leave'].includes(status)) {
    throw new ValidationError({ status: 'Unknown status.' });
  }
  await sleep(180);
  return mutate((db) => {
    const profile = db.profiles.find((p) => p.id === active.userId);
    if (!profile) throw new NotFoundError('Profile not found.');
    const open = db.attendance.find((e) => e.employeeId === active.userId && !e.clockOut);
    if ((status === 'working' || status === 'on_break') && !open) {
      throw new ConflictError('Clock in before setting a working status.');
    }
    const presence = upsertPresence(db.presence, active.userId, status, profile.workMode);
    recordAudit(db, active, 'presence.updated', 'presence', active.userId, { status });
    return presence;
  });
}

export async function setWorkMode(session: Session | null, workMode: WorkMode): Promise<Presence> {
  const active = requireSession(session);
  await sleep(180);
  return mutate((db) => {
    const presence = db.presence.find((p) => p.employeeId === active.userId);
    const next = upsertPresence(db.presence, active.userId, presence?.status ?? 'off_shift', workMode);
    const open = db.attendance.find((e) => e.employeeId === active.userId && !e.clockOut);
    if (open) open.workMode = workMode;
    recordAudit(db, active, 'presence.work_mode', 'presence', active.userId, { workMode });
    return next;
  });
}

export interface PresenceRow {
  profile: Profile;
  presence: Presence;
  openSince: string | null;
  todayMinutes: number;
}

/** Live remote-workforce board. Any signed-in user can see who is available. */
export async function listPresence(session: Session | null): Promise<PresenceRow[]> {
  requireSession(session);
  await sleep(240);
  const db = getDb();
  const today = todayISO();
  return db.profiles.
  filter((p) => p.status === 'active').
  map((profile) => {
    const presence = db.presence.find((p) => p.employeeId === profile.id) ?? {
      employeeId: profile.id,
      status: 'off_shift' as const,
      workMode: profile.workMode,
      updatedAt: profile.createdAt
    };
    const todays = db.attendance.filter((e) => e.employeeId === profile.id && e.date === today);
    const open = todays.find((e) => !e.clockOut);
    return {
      profile,
      presence,
      openSince: open ? open.clockIn : null,
      todayMinutes: todays.reduce((sum, entry) => sum + workedMinutes(entry), 0)
    };
  }).
  sort((a, b) => a.profile.fullName.localeCompare(b.profile.fullName));
}

/** HR correction of a historical entry, always audited. */
export async function amendAttendance(
session: Session | null,
entryId: string,
breakMinutes: number,
note: string)
: Promise<AttendanceEntry> {
  const active = requireAdmin(session);
  if (breakMinutes < 0 || breakMinutes > 480) {
    throw new ValidationError({ breakMinutes: 'Break minutes must be between 0 and 480.' });
  }
  await sleep(260);
  return mutate((db) => {
    const entry = db.attendance.find((e) => e.id === entryId);
    if (!entry) throw new NotFoundError('Attendance entry not found.');
    const previous = entry.breakMinutes;
    entry.breakMinutes = Math.round(breakMinutes);
    entry.note = note.trim();
    recordAudit(db, active, 'attendance.amended', 'attendance', entryId, {
      employeeId: entry.employeeId,
      previousBreakMinutes: previous,
      breakMinutes: entry.breakMinutes
    });
    return entry;
  });
}

function upsertPresence(
rows: Presence[],
employeeId: string,
status: Presence['status'],
workMode: WorkMode)
: Presence {
  const existing = rows.find((p) => p.employeeId === employeeId);
  if (existing) {
    existing.status = status;
    existing.workMode = workMode;
    existing.updatedAt = nowIso();
    return existing;
  }
  const created: Presence = { employeeId, status, workMode, updatedAt: nowIso() };
  rows.push(created);
  return created;
}