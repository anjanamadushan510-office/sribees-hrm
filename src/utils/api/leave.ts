import type { LeaveBalance, LeaveRequest, LeaveStatus, LeaveType, Profile, Session } from '../../types';
import { getSupabase } from '../../lib/supabase/client';
import { mapLeaveRequestFromDb, mapProfileFromDb } from '../../types/database.types';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
  getProfileOrThrow,
  isAdmin,
  requireAdmin,
  requireSelfOrAdmin,
  requireSession
} from '../policies';
import { getDb, mutate, nowIso, sleep, uid } from '../store';
import { businessDaysBetween, datesOverlap, todayISO } from '../time';
import { hasErrors, validateLeave } from '../validation';
import type { LeaveInput } from '../validation';
import { recordAudit } from './audit';
import { notifyAdmins, pushNotification } from './notifications';

export const LEAVE_TYPES: LeaveType[] = [
  'casual',
  'sick',
  'half_day',
  'birthday',
  'lieu',
  'unpaid',
  'annual',
  'parental'
];

export const LEAVE_TYPE_LABEL: Record<string, string> = {
  casual: 'Casual Leave',
  sick: 'Sick Leave',
  half_day: 'Half Day Leave',
  birthday: 'Birthday Leave',
  lieu: 'Lieu Leave',
  unpaid: 'No Pay Leave',
  annual: 'Annual Leave',
  parental: 'Parental Leave'
};

export const LEAVE_TYPE_DESCRIPTIONS: Record<string, string> = {
  casual: 'For personal plans. Please request 2-3 days in advance.',
  sick: 'For health issues. Inform HR & your Team Lead ASAP.',
  half_day: 'For brief personal matters (Morning/Evening).',
  birthday: 'Enjoy your special day! Take a day off on your birthday. 🎂',
  lieu: 'Compensatory time off for working on weekends or public holidays.',
  unpaid: 'For extended time off or when paid leave balances are exhausted. Requires prior management approval.',
  annual: 'Standard annual vacation days.',
  parental: 'Maternity or paternity leave entitlement.'
};

export const DEFAULT_LEAVE_QUOTAS: Record<string, number> = {
  casual: 7,
  sick: 7,
  half_day: 4,
  birthday: 1,
  lieu: 5,
  unpaid: 15,
  annual: 14,
  parental: 30
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
  const scopedEmployeeId = isAdmin(active) ? filter.employeeId : active.userId;
  if (!isAdmin(active) && filter.employeeId && filter.employeeId !== active.userId) {
    throw new ForbiddenError('You can only view your own leave requests.');
  }

  const supabase = getSupabase();
  if (supabase) {
    let query = supabase.from('leave_requests').select('*');
    if (scopedEmployeeId) query = query.eq('employee_id', scopedEmployeeId);
    if (filter.status && filter.status !== 'all') query = query.eq('status', filter.status);
    if (filter.type && filter.type !== 'all') query = query.eq('type', filter.type);

    const { data: requests, error } = await query.order('created_at', { ascending: false });
    if (error) throw new Error(error.message);

    const { data: profiles } = await supabase.from('profiles').select('id, full_name, job_title, department');
    const profileMap = new Map((profiles || []).map((p) => [p.id, mapProfileFromDb(p as any)]));

    return (requests || []).map((reqRow) => {
      const req = mapLeaveRequestFromDb(reqRow);
      const employee = profileMap.get(req.employeeId);
      return {
        ...req,
        employee: {
          id: req.employeeId,
          fullName: employee?.fullName ?? 'Former employee',
          jobTitle: employee?.jobTitle ?? '—',
          department: employee?.department ?? '—'
        }
      };
    });
  }

  await sleep();
  const db = getDb();
  return db.leaveRequests
    .filter((r) => (scopedEmployeeId ? r.employeeId === scopedEmployeeId : true))
    .filter((r) => (filter.status && filter.status !== 'all' ? r.status === filter.status : true))
    .filter((r) => (filter.type && filter.type !== 'all' ? r.type === filter.type : true))
    .map((request) => {
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
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getLeaveBalances(session: Session | null, employeeId: string): Promise<LeaveBalance[]> {
  requireSelfOrAdmin(session, employeeId);
  const supabase = getSupabase();

  if (supabase) {
    const year = new Date().getFullYear();
    const [entitlementsRes, requestsRes] = await Promise.all([
      supabase.from('leave_entitlements').select('*').eq('employee_id', employeeId).eq('year', year),
      supabase.from('leave_requests').select('*').eq('employee_id', employeeId)
    ]);

    const entitlements = entitlementsRes.data || [];
    const requests = (requestsRes.data || []).map(mapLeaveRequestFromDb);

    return LEAVE_TYPES.map((type) => {
      const entitlement = entitlements.find((e) => e.type === type);
      const entitlementDays = entitlement?.days ?? DEFAULT_LEAVE_QUOTAS[type] ?? 0;
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

  const days = businessDaysBetween(input.startDate, input.endDate);
  const supabase = getSupabase();

  if (supabase) {
    const { data, error } = await supabase
      .from('leave_requests')
      .insert({
        employee_id: active.userId,
        type: input.type,
        start_date: input.startDate,
        end_date: input.endDate,
        days,
        reason: input.reason.trim(),
        status: 'pending',
        decision_note: ''
      })
      .select()
      .single();

    if (error || !data) throw new ConflictError(error?.message || 'Failed to submit leave request.');
    return mapLeaveRequestFromDb(data);
  }

  await sleep(360);
  return mutate((db) => {
    const profile = getProfileOrThrow(active.userId);

    const clash = db.leaveRequests.find(
      (r) =>
        r.employeeId === active.userId &&
        (r.status === 'pending' || r.status === 'approved') &&
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
            input.type
          ].toLowerCase()} remain this year.`
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
  note: string
): Promise<LeaveRequest> {
  const active = requireAdmin(session);
  if (note.length > 300) throw new ValidationError({ decisionNote: 'Keep the note under 300 characters.' });

  const supabase = getSupabase();
  if (supabase) {
    const { data, error } = await supabase
      .from('leave_requests')
      .update({
        status: decision,
        decided_by: active.userId,
        decided_at: new Date().toISOString(),
        decision_note: note.trim()
      })
      .eq('id', requestId)
      .select()
      .single();

    if (error || !data) throw new NotFoundError(error?.message || 'Leave request not found.');
    return mapLeaveRequestFromDb(data);
  }

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
  const supabase = getSupabase();

  if (supabase) {
    const { data, error } = await supabase
      .from('leave_requests')
      .update({ status: 'cancelled' })
      .eq('id', requestId)
      .select()
      .single();

    if (error || !data) throw new NotFoundError('Leave request not found.');
    return mapLeaveRequestFromDb(data);
  }

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
  days: number
): Promise<LeaveBalance[]> {
  const active = requireAdmin(session);
  if (!Number.isFinite(days) || days < 0 || days > 365) {
    throw new ValidationError({ days: 'Entitlement must be between 0 and 365 days.' });
  }

  const supabase = getSupabase();
  const year = new Date().getFullYear();

  if (supabase) {
    await supabase.from('leave_entitlements').upsert({
      employee_id: employeeId,
      year,
      type,
      days: Math.round(days)
    });
    return getLeaveBalances(session, employeeId);
  }

  await sleep(260);
  return mutate((db) => {
    const existing = db.leaveEntitlements.find(
      (e) => e.employeeId === employeeId && e.year === year && e.type === type
    );
    if (existing) existing.days = Math.round(days);
    else db.leaveEntitlements.push({ employeeId, year, type, days: Math.round(days) });
    recordAudit(db, active, 'leave.entitlement_updated', 'leave_entitlement', employeeId, { type, days });
    return computeBalances(employeeId);
  });
}

export async function updateEmployeeEntitlements(
  session: Session | null,
  employeeId: string,
  entitlementsMap: Record<string, number>
): Promise<LeaveBalance[]> {
  const active = requireAdmin(session);
  const supabase = getSupabase();
  const year = new Date().getFullYear();

  if (supabase) {
    const upsertRows = Object.entries(entitlementsMap).map(([type, days]) => ({
      employee_id: employeeId,
      year,
      type,
      days: Math.max(0, Math.min(365, Math.round(days || 0)))
    }));

    await supabase.from('leave_entitlements').upsert(upsertRows);
    return getLeaveBalances(session, employeeId);
  }

  await sleep(300);
  return mutate((db) => {
    Object.entries(entitlementsMap).forEach(([type, days]) => {
      const parsedDays = Math.max(0, Math.min(365, Math.round(days || 0)));
      const existing = db.leaveEntitlements.find(
        (e) => e.employeeId === employeeId && e.year === year && e.type === type
      );
      if (existing) {
        existing.days = parsedDays;
      } else {
        db.leaveEntitlements.push({ employeeId, year, type, days: parsedDays });
      }
    });
    recordAudit(db, active, 'leave.entitlements_updated_bulk', 'leave_entitlement', employeeId, entitlementsMap);
    return computeBalances(employeeId);
  });
}