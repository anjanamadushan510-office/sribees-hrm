import type { LeaveBalance, LeaveRequest, LeaveStatus, LeaveType, Profile, Session } from '../../types';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
  getProfileOrThrow,
  isAdmin,
  requireAdmin,
  requireSelfOrAdmin,
  requireSession } from
'../policies';
import { getDb, mutate, nowIso, sleep, uid } from '../store';
import { businessDaysBetween, datesOverlap, todayISO } from '../time';
import { hasErrors, validateLeave } from '../validation';
import type { LeaveInput } from '../validation';
import { recordAudit } from './audit';
import { notifyAdmins, pushNotification } from './notifications';

export const LEAVE_TYPES: LeaveType[] = ['annual', 'sick', 'parental', 'unpaid'];

export const LEAVE_TYPE_LABEL: Record<LeaveType, string> = {
  annual: 'Annual leave',
  sick: 'Sick leave',
  parental: 'Parental leave',
  unpaid: 'Unpaid leave'
};

export interface LeaveFilter {
  employeeId?: string;
  status?: LeaveStatus | 'all';
  type?: LeaveType | 'all';
}

export interface LeaveRequestRow extends LeaveRequest {
  employee: Pick<Profile, 'id' | 'fullName' | 'jobTitle' | 'department'>;
}

export async function listLeaveRequests(session: Session | null, filter: LeaveFilter = {}): Promise<LeaveRequestRow[]> {
  const active = requireSession(session);
  // Employees may only ever read their own rows, whatever they ask for.
  const scopedEmployeeId = isAdmin(active) ? filter.employeeId : active.userId;
  if (!isAdmin(active) && filter.employeeId && filter.employeeId !== active.userId) {
    throw new ForbiddenError('You can only view your own leave requests.');
  }
  await sleep();

  const db = getDb();
  return db.leaveRequests.
  filter((r) => scopedEmployeeId ? r.employeeId === scopedEmployeeId : true).
  filter((r) => filter.status && filter.status !== 'all' ? r.status === filter.status : true).
  filter((r) => filter.type && filter.type !== 'all' ? r.type === filter.type : true).
  map((request) => {
    const employee = db.profiles.find((p) => p.id === request.employeeId);
    return {
      ...request,
      employee: {
        id: request.employeeId,
        fullName: employee?.fullName ?? 'Former employee',
        jobTitle: employee?.jobTitle ?? '—',
        department: employee?.department ?? '—'
      }
    };
  }).
  sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * Balances are always DERIVED from the request table, never stored as a counter,
 * so an approval and its balance can never drift apart.
 */
export async function getLeaveBalances(session: Session | null, employeeId: string): Promise<LeaveBalance[]> {
  requireSelfOrAdmin(session, employeeId);
  await sleep(220);
  return computeBalances(employeeId);
}

export function computeBalances(employeeId: string, year = new Date().getFullYear()): LeaveBalance[] {
  const db = getDb();
  const requests = db.leaveRequests.filter(
    (r) => r.employeeId === employeeId && Number(r.startDate.slice(0, 4)) === year
  );
  return LEAVE_TYPES.map((type) => {
    const entitlement = db.leaveEntitlements.find(
      (e) => e.employeeId === employeeId && e.year === year && e.type === type
    );
    const entitlementDays = entitlement?.days ?? 0;
    const approvedDays = requests.filter((r) => r.type === type && r.status === 'approved').reduce((s, r) => s + r.days, 0);
    const pendingDays = requests.filter((r) => r.type === type && r.status === 'pending').reduce((s, r) => s + r.days, 0);
    return {
      type,
      entitlementDays,
      approvedDays,
      pendingDays,
      remainingDays: entitlementDays - approvedDays - pendingDays
    };
  });
}

export async function createLeaveRequest(session: Session | null, input: LeaveInput): Promise<LeaveRequest> {
  const active = requireSession(session);
  const errors = validateLeave(input);
  if (hasErrors(errors)) throw new ValidationError(errors);
  await sleep(360);

  const days = businessDaysBetween(input.startDate, input.endDate);

  return mutate((db) => {
    const profile = getProfileOrThrow(active.userId);

    const clash = db.leaveRequests.find(
      (r) =>
      r.employeeId === active.userId && (
      r.status === 'pending' || r.status === 'approved') &&
      datesOverlap(input.startDate, input.endDate, r.startDate, r.endDate)
    );
    if (clash) {
      throw new ConflictError('These dates overlap a request you have already submitted.');
    }

    if (input.type !== 'unpaid') {
      const balance = computeBalances(active.userId).find((b) => b.type === input.type);
      if (balance && days > balance.remainingDays) {
        throw new ConflictError(
          `Only ${balance.remainingDays} day${balance.remainingDays === 1 ? '' : 's'} of ${LEAVE_TYPE_LABEL[
          input.type].
          toLowerCase()} remain this year.`
        );
      }
    }

    const request: LeaveRequest = {
      id: uid('lv'),
      employeeId: active.userId,
      type: input.type,
      startDate: input.startDate,
      endDate: input.endDate,
      days,
      reason: input.reason.trim(),
      status: 'pending',
      decidedBy: null,
      decidedAt: null,
      decisionNote: '',
      createdAt: nowIso()
    };
    db.leaveRequests.unshift(request);
    recordAudit(db, active, 'leave.submitted', 'leave_request', request.id, { type: request.type, days });
    notifyAdmins(
      db,
      'leave_submitted',
      `${profile.fullName} requested ${LEAVE_TYPE_LABEL[request.type].toLowerCase()}`,
      `${days} working day${days === 1 ? '' : 's'} awaiting your decision.`,
      '/leave'
    );
    return request;
  });
}

export async function decideLeaveRequest(
session: Session | null,
requestId: string,
decision: 'approved' | 'rejected',
note: string)
: Promise<LeaveRequest> {
  const active = requireAdmin(session);
  if (note.length > 300) throw new ValidationError({ decisionNote: 'Keep the note under 300 characters.' });
  await sleep(340);

  return mutate((db) => {
    const request = db.leaveRequests.find((r) => r.id === requestId);
    if (!request) throw new NotFoundError('Leave request not found.');
    if (request.status !== 'pending') throw new ConflictError('That request has already been decided.');
    if (request.employeeId === active.userId) {
      throw new ForbiddenError('You cannot decide on your own leave request. Ask another administrator.');
    }
    if (decision === 'rejected' && !note.trim()) {
      throw new ValidationError({ decisionNote: 'Explain the rejection so the employee knows what to do next.' });
    }

    if (decision === 'approved' && request.type !== 'unpaid') {
      const balance = computeBalances(request.employeeId).find((b) => b.type === request.type);
      const availableIfApproved = balance ? balance.entitlementDays - balance.approvedDays : 0;
      if (request.days > availableIfApproved) {
        throw new ConflictError('Approving this would exceed the remaining entitlement.');
      }
    }

    request.status = decision;
    request.decidedBy = active.userId;
    request.decidedAt = nowIso();
    request.decisionNote = note.trim();

    if (decision === 'approved') {
      const today = todayISO();
      if (request.startDate <= today && request.endDate >= today) {
        const presence = db.presence.find((p) => p.employeeId === request.employeeId);
        if (presence) presence.status = 'on_leave';
      }
    }

    recordAudit(db, active, `leave.${decision}`, 'leave_request', request.id, {
      employeeId: request.employeeId,
      days: request.days
    });
    pushNotification(
      db,
      request.employeeId,
      'leave_decided',
      `Your ${LEAVE_TYPE_LABEL[request.type].toLowerCase()} was ${decision}`,
      note.trim() || `${request.days} working day${request.days === 1 ? '' : 's'} from ${request.startDate}.`,
      '/leave'
    );
    return request;
  });
}

export async function cancelLeaveRequest(session: Session | null, requestId: string): Promise<LeaveRequest> {
  const active = requireSession(session);
  await sleep(260);
  return mutate((db) => {
    const request = db.leaveRequests.find((r) => r.id === requestId);
    if (!request) throw new NotFoundError('Leave request not found.');
    if (request.employeeId !== active.userId && !isAdmin(active)) {
      throw new ForbiddenError('You can only cancel your own requests.');
    }
    if (request.status === 'rejected' || request.status === 'cancelled') {
      throw new ConflictError('That request is already closed.');
    }
    if (request.status === 'approved' && request.startDate <= todayISO() && !isAdmin(active)) {
      throw new ConflictError('Leave that has already started must be cancelled by HR.');
    }
    request.status = 'cancelled';
    recordAudit(db, active, 'leave.cancelled', 'leave_request', request.id, { employeeId: request.employeeId });
    if (request.employeeId !== active.userId) {
      pushNotification(
        db,
        request.employeeId,
        'leave_decided',
        'HR cancelled your leave request',
        `${LEAVE_TYPE_LABEL[request.type]} from ${request.startDate} was cancelled.`,
        '/leave'
      );
    }
    return request;
  });
}

export async function setEntitlement(
session: Session | null,
employeeId: string,
type: LeaveType,
days: number)
: Promise<LeaveBalance[]> {
  const active = requireAdmin(session);
  if (!Number.isFinite(days) || days < 0 || days > 365) {
    throw new ValidationError({ days: 'Entitlement must be between 0 and 365 days.' });
  }
  await sleep(260);
  const year = new Date().getFullYear();
  return mutate((db) => {
    const existing = db.leaveEntitlements.find(
      (e) => e.employeeId === employeeId && e.year === year && e.type === type
    );
    if (existing) existing.days = Math.round(days);else
    db.leaveEntitlements.push({ employeeId, year, type, days: Math.round(days) });
    recordAudit(db, active, 'leave.entitlement_updated', 'leave_entitlement', employeeId, { type, days });
    return computeBalances(employeeId);
  });
}