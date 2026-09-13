import type { EmploymentStatus, Invitation, Profile, Role, Session, WorkMode } from '../../types';
import { getSupabase } from '../../lib/supabase/client';
import { mapInvitationFromDb, mapProfileFromDb } from '../../types/database.types';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
  assertProfileFieldsAllowed,
  getProfileOrThrow,
  redactProfile,
  requireAdmin,
  requireSelfOrAdmin,
  requireSession
} from '../policies';
import { getDb, mutate, nowIso, sleep, uid } from '../store';
import { hasErrors, validateInvite, validateProfile } from '../validation';
import type { InviteInput, ProfileInput } from '../validation';
import { recordAudit } from './audit';
import { notifyAdmins, pushNotification } from './notifications';

export interface EmployeeFilter {
  search?: string;
  department?: string;
  status?: EmploymentStatus | 'all';
  workMode?: WorkMode | 'all';
}

export async function listEmployees(session: Session | null, filter: EmployeeFilter = {}): Promise<Profile[]> {
  const active = requireSession(session);
  const supabase = getSupabase();

  if (supabase) {
    let query = supabase.from('profiles').select('*');
    if (filter.department && filter.department !== 'all') {
      query = query.eq('department', filter.department);
    }
    if (filter.status && filter.status !== 'all') {
      query = query.eq('status', filter.status);
    }
    if (filter.workMode && filter.workMode !== 'all') {
      query = query.eq('work_mode', filter.workMode);
    }
    if (filter.search?.trim()) {
      const search = filter.search.trim();
      query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%,job_title.ilike.%${search}%,department.ilike.%${search}%`);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    return (data || [])
      .map(mapProfileFromDb)
      .map((p) => redactProfile(active, p))
      .sort((a, b) => a.fullName.localeCompare(b.fullName));
  }

  await sleep();
  const search = filter.search?.trim().toLowerCase() ?? '';
  return getDb()
    .profiles.filter((p) => (filter.department && filter.department !== 'all' ? p.department === filter.department : true))
    .filter((p) => (filter.status && filter.status !== 'all' ? p.status === filter.status : true))
    .filter((p) => (filter.workMode && filter.workMode !== 'all' ? p.workMode === filter.workMode : true))
    .filter((p) => (search ? `${p.fullName} ${p.email} ${p.jobTitle} ${p.department}`.toLowerCase().includes(search) : true))
    .map((p) => redactProfile(active, p))
    .sort((a, b) => a.fullName.localeCompare(b.fullName));
}

export async function getEmployee(session: Session | null, employeeId: string): Promise<Profile> {
  const active = requireSession(session);
  const supabase = getSupabase();

  if (supabase) {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', employeeId).single();
    if (error || !data) throw new NotFoundError('Employee not found.');
    return redactProfile(active, mapProfileFromDb(data));
  }

  await sleep(200);
  return redactProfile(active, getProfileOrThrow(employeeId));
}

/** Employees may edit a whitelisted subset of their own row; HR may edit any row. */
export async function updateEmployeeProfile(
  session: Session | null,
  employeeId: string,
  input: ProfileInput
): Promise<Profile> {
  const active = requireSelfOrAdmin(session, employeeId);
  assertProfileFieldsAllowed(active, employeeId, Object.keys(input));
  const errors = validateProfile(input);
  if (hasErrors(errors)) throw new ValidationError(errors);

  const supabase = getSupabase();
  if (supabase) {
    const updatePayload: Record<string, any> = {
      phone: input.phone.trim(),
      location: input.location.trim(),
      timezone: input.timezone.trim(),
      emergency_contact: input.emergencyContact.trim(),
      updated_at: new Date().toISOString()
    };
    if (input.workMode) updatePayload.work_mode = input.workMode;

    const { data, error } = await supabase
      .from('profiles')
      .update(updatePayload)
      .eq('id', employeeId)
      .select()
      .single();

    if (error || !data) throw new NotFoundError('Employee profile update failed: ' + (error?.message || 'Not found'));
    return redactProfile(active, mapProfileFromDb(data));
  }

  await sleep();
  return mutate((db) => {
    const profile = db.profiles.find((p) => p.id === employeeId);
    if (!profile) throw new NotFoundError('Employee not found.');
    profile.phone = input.phone.trim();
    profile.location = input.location.trim();
    profile.timezone = input.timezone.trim();
    profile.emergencyContact = input.emergencyContact.trim();
    if (input.workMode) profile.workMode = input.workMode;
    recordAudit(db, active, 'profile.updated', 'profile', employeeId, { fields: Object.keys(input).join(',') });
    return redactProfile(active, profile);
  });
}

export interface EmploymentInput {
  jobTitle: string;
  department: string;
  workMode: WorkMode;
  role: Role;
  managerId: string | null;
}

/** HR-only fields: job, department, work mode, role, reporting line. */
export async function updateEmployment(
  session: Session | null,
  employeeId: string,
  input: EmploymentInput
): Promise<Profile> {
  const active = requireAdmin(session);
  const errors: Record<string, string> = {};
  if (!input.jobTitle.trim()) errors.jobTitle = 'Job title is required.';
  if (!input.department.trim()) errors.department = 'Department is required.';
  if (!['office', 'remote', 'hybrid'].includes(input.workMode)) errors.workMode = 'Choose a work mode.';
  if (!['admin', 'employee'].includes(input.role)) errors.role = 'Choose a valid role.';
  if (hasErrors(errors)) throw new ValidationError(errors);

  const supabase = getSupabase();
  if (supabase) {
    if (input.managerId === employeeId) throw new ValidationError({ managerId: 'Someone cannot manage themselves.' });

    const updatePayload = {
      job_title: input.jobTitle.trim(),
      department: input.department.trim(),
      work_mode: input.workMode,
      role: input.role,
      manager_id: input.managerId,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('profiles')
      .update(updatePayload)
      .eq('id', employeeId)
      .select()
      .single();

    if (error || !data) throw new NotFoundError(error?.message || 'Employee not found.');

    await supabase
      .from('presence')
      .update({ work_mode: input.workMode, updated_at: new Date().toISOString() })
      .eq('employee_id', employeeId);

    return mapProfileFromDb(data);
  }

  await sleep();
  return mutate((db) => {
    const profile = db.profiles.find((p) => p.id === employeeId);
    if (!profile) throw new NotFoundError('Employee not found.');

    if (profile.role === 'admin' && input.role !== 'admin') {
      const remainingAdmins = db.profiles.filter(
        (p) => p.role === 'admin' && p.status === 'active' && p.id !== employeeId
      ).length;
      if (remainingAdmins === 0) throw new ConflictError('At least one active HR administrator is required.');
    }
    if (input.managerId === employeeId) throw new ValidationError({ managerId: 'Someone cannot manage themselves.' });

    const roleChanged = profile.role !== input.role;
    profile.jobTitle = input.jobTitle.trim();
    profile.department = input.department.trim();
    profile.workMode = input.workMode;
    profile.role = input.role;
    profile.managerId = input.managerId;

    const presence = db.presence.find((p) => p.employeeId === employeeId);
    if (presence) presence.workMode = input.workMode;

    recordAudit(db, active, roleChanged ? 'employee.role_changed' : 'employee.updated', 'profile', employeeId, {
      role: input.role,
      department: input.department,
      workMode: input.workMode
    });
    if (roleChanged) {
      pushNotification(
        db,
        employeeId,
        'invitation_accepted',
        'Your access level changed',
        `You now have ${input.role === 'admin' ? 'HR administrator' : 'employee'} access.`,
        '/profile'
      );
    }
    return profile;
  });
}

export async function setEmployeeStatus(
  session: Session | null,
  employeeId: string,
  status: EmploymentStatus
): Promise<Profile> {
  const active = requireAdmin(session);
  if (active.userId === employeeId) throw new ForbiddenError('You cannot change your own account status.');

  const supabase = getSupabase();
  if (supabase) {
    const { data, error } = await supabase
      .from('profiles')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', employeeId)
      .select()
      .single();

    if (error || !data) throw new NotFoundError(error?.message || 'Employee not found.');
    if (status !== 'active') {
      await supabase
        .from('presence')
        .update({ status: 'off_shift', updated_at: new Date().toISOString() })
        .eq('employee_id', employeeId);
    }
    return mapProfileFromDb(data);
  }

  await sleep();
  return mutate((db) => {
    const profile = db.profiles.find((p) => p.id === employeeId);
    if (!profile) throw new NotFoundError('Employee not found.');
    if (profile.role === 'admin' && status !== 'active') {
      const remaining = db.profiles.filter((p) => p.role === 'admin' && p.status === 'active' && p.id !== employeeId);
      if (remaining.length === 0) throw new ConflictError('At least one active HR administrator is required.');
    }
    profile.status = status;
    const presence = db.presence.find((p) => p.employeeId === employeeId);
    if (presence && status !== 'active') presence.status = 'off_shift';
    recordAudit(db, active, `employee.${status === 'active' ? 'reinstated' : 'suspended'}`, 'profile', employeeId, {
      status
    });
    return profile;
  });
}

/* ---------------------------------- Invitations --------------------------------- */

export async function listInvitations(session: Session | null): Promise<Invitation[]> {
  requireAdmin(session);
  const supabase = getSupabase();

  if (supabase) {
    const { data, error } = await supabase
      .from('invitations')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    const now = Date.now();
    return (data || []).map((row) => {
      const invite = mapInvitationFromDb(row);
      if (invite.status === 'pending' && new Date(invite.expiresAt).getTime() < now) {
        return { ...invite, status: 'expired' as const };
      }
      return invite;
    });
  }

  await sleep(220);
  const now = Date.now();
  return getDb()
    .invitations.map((invite) =>
      invite.status === 'pending' && new Date(invite.expiresAt).getTime() < now
        ? { ...invite, status: 'expired' as const }
        : invite
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function inviteEmployee(session: Session | null, input: InviteInput): Promise<Invitation> {
  const active = requireAdmin(session);
  const errors = validateInvite(input);
  if (hasErrors(errors)) throw new ValidationError(errors);

  const supabase = getSupabase();
  if (supabase) {
    const email = input.email.trim().toLowerCase();
    const defaultPassword = input.defaultPassword?.trim() || 'Sribees@2026';

    const { data: existingProfile } = await supabase.from('profiles').select('id').eq('email', email).maybeSingle();
    if (existingProfile) throw new ConflictError('Someone with that email already has an account.');

    const tokenHash = Math.random().toString(36).substring(2) + Date.now().toString(36);
    const expiresAt = new Date(Date.now() + 7 * 86400_000).toISOString();

    const { data: inviteRow, error: inviteError } = await supabase
      .from('invitations')
      .insert({
        email,
        full_name: input.fullName.trim(),
        role: input.role,
        job_title: input.jobTitle.trim(),
        department: input.department.trim(),
        work_mode: input.workMode,
        token_hash: tokenHash,
        status: 'pending',
        invited_by: active.userId,
        expires_at: expiresAt
      })
      .select()
      .single();

    if (inviteError || !inviteRow) {
      throw new ConflictError(inviteError?.message || 'Failed to create invitation record.');
    }

    const invitation = mapInvitationFromDb(inviteRow);
    invitation.defaultPassword = defaultPassword;
    return invitation;
  }

  await sleep(380);
  const email = input.email.trim().toLowerCase();
  const defaultPassword = input.defaultPassword?.trim() || 'Sribees@2026';
  const year = new Date().getFullYear();

  return mutate((db) => {
    if (db.profiles.some((p) => p.email.toLowerCase() === email)) {
      throw new ConflictError('Someone with that email already has an account.');
    }
    if (db.invitations.some((i) => i.email.toLowerCase() === email && i.status === 'pending')) {
      throw new ConflictError('There is already a pending invitation for that email.');
    }

    const newUserId = uid('u');
    const profile: Profile = {
      id: newUserId,
      email,
      fullName: input.fullName.trim(),
      role: input.role,
      jobTitle: input.jobTitle.trim(),
      department: input.department.trim(),
      managerId: active.userId,
      phone: '',
      location: '',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      workMode: input.workMode,
      status: 'active',
      hireDate: nowIso().slice(0, 10),
      emergencyContact: '',
      mustChangePassword: true,
      createdAt: nowIso()
    };

    db.profiles.push(profile);
    db.credentials[email] = defaultPassword;

    db.presence.push({
      employeeId: profile.id,
      status: 'off_shift',
      workMode: profile.workMode,
      updatedAt: nowIso()
    });

    db.leaveEntitlements.push(
      { employeeId: profile.id, year, type: 'annual', days: 25 },
      { employeeId: profile.id, year, type: 'sick', days: 10 },
      { employeeId: profile.id, year, type: 'parental', days: 20 },
      { employeeId: profile.id, year, type: 'unpaid', days: 15 }
    );

    const invitation: Invitation = {
      id: uid('inv'),
      email,
      fullName: input.fullName.trim(),
      role: input.role,
      jobTitle: input.jobTitle.trim(),
      department: input.department.trim(),
      workMode: input.workMode,
      token: uid('token'),
      status: 'pending',
      invitedBy: active.userId,
      defaultPassword,
      createdAt: nowIso(),
      expiresAt: new Date(Date.now() + 7 * 86400_000).toISOString()
    };
    db.invitations.unshift(invitation);
    recordAudit(db, active, 'invitation.sent', 'invitation', invitation.id, { email, role: input.role });
    notifyAdmins(
      db,
      'invitation_sent',
      `Employee added: ${invitation.fullName}`,
      `${invitation.jobTitle} · ${invitation.department}. Default password set.`,
      '/employees',
      active.userId
    );
    return invitation;
  });
}

export async function revokeInvitation(session: Session | null, invitationId: string): Promise<void> {
  const active = requireAdmin(session);
  const supabase = getSupabase();

  if (supabase) {
    const { error } = await supabase
      .from('invitations')
      .update({ status: 'revoked' })
      .eq('id', invitationId);

    if (error) throw new NotFoundError('Invitation update failed: ' + error.message);
    return;
  }

  await sleep(240);
  mutate((db) => {
    const invitation = db.invitations.find((i) => i.id === invitationId);
    if (!invitation) throw new NotFoundError('Invitation not found.');
    if (invitation.status !== 'pending') throw new ConflictError('Only pending invitations can be revoked.');
    invitation.status = 'revoked';
    recordAudit(db, active, 'invitation.revoked', 'invitation', invitationId, { email: invitation.email });
  });
}

export async function resendInvitation(session: Session | null, invitationId: string): Promise<Invitation> {
  const active = requireAdmin(session);
  const supabase = getSupabase();

  if (supabase) {
    const newToken = Math.random().toString(36).substring(2) + Date.now().toString(36);
    const expiresAt = new Date(Date.now() + 7 * 86400_000).toISOString();

    const { data, error } = await supabase
      .from('invitations')
      .update({ status: 'pending', token_hash: newToken, expires_at: expiresAt })
      .eq('id', invitationId)
      .select()
      .single();

    if (error || !data) throw new NotFoundError('Invitation update failed: ' + (error?.message || 'Not found'));
    return mapInvitationFromDb(data);
  }

  await sleep(300);
  return mutate((db) => {
    const invitation = db.invitations.find((i) => i.id === invitationId);
    if (!invitation) throw new NotFoundError('Invitation not found.');
    if (invitation.status === 'accepted') throw new ConflictError('That invitation was already accepted.');
    invitation.status = 'pending';
    invitation.token = uid('token');
    invitation.expiresAt = new Date(Date.now() + 7 * 86400_000).toISOString();
    recordAudit(db, active, 'invitation.resent', 'invitation', invitationId, { email: invitation.email });
    return invitation;
  });
}

export async function findInvitationByToken(token: string): Promise<Invitation> {
  const supabase = getSupabase();
  if (supabase) {
    const { data, error } = await supabase.from('invitations').select('*').eq('token_hash', token).single();
    if (error || !data) throw new NotFoundError('This invitation link is not valid.');
    const invitation = mapInvitationFromDb(data);
    if (invitation.status === 'accepted') throw new ConflictError('This invitation has already been used.');
    if (invitation.status === 'revoked') throw new ConflictError('This invitation was revoked by HR.');
    if (new Date(invitation.expiresAt).getTime() < Date.now()) {
      throw new ConflictError('This invitation has expired. Ask HR to send a new one.');
    }
    return invitation;
  }

  await sleep(240);
  const invitation = getDb().invitations.find((i) => i.token === token);
  if (!invitation) throw new NotFoundError('This invitation link is not valid.');
  if (invitation.status === 'accepted') throw new ConflictError('This invitation has already been used.');
  if (invitation.status === 'revoked') throw new ConflictError('This invitation was revoked by HR.');
  if (new Date(invitation.expiresAt).getTime() < Date.now()) {
    throw new ConflictError('This invitation has expired. Ask HR to send a new one.');
  }
  return invitation;
}

export async function acceptInvitation(token: string, password: string, confirm: string): Promise<void> {
  const errors: Record<string, string> = {};
  if (password.length < 8) errors.password = 'Choose a password with at least 8 characters.';
  if (password !== confirm) errors.confirm = 'Passwords do not match.';
  if (hasErrors(errors)) throw new ValidationError(errors);

  const supabase = getSupabase();
  if (supabase) {
    const { error: rpcError } = await supabase.rpc('accept_invitation', {
      p_token_hash: token,
      p_password: password
    });
    if (rpcError) {
      throw new ConflictError(rpcError.message);
    }
    return;
  }

  const invitation = await findInvitationByToken(token);
  await sleep(420);

  mutate((db) => {
    const year = new Date().getFullYear();
    const profile: Profile = {
      id: uid('u'),
      email: invitation.email,
      fullName: invitation.fullName,
      role: invitation.role,
      jobTitle: invitation.jobTitle,
      department: invitation.department,
      managerId: invitation.invitedBy,
      phone: '',
      location: '',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      workMode: invitation.workMode,
      status: 'active',
      hireDate: nowIso().slice(0, 10),
      emergencyContact: '',
      createdAt: nowIso()
    };
    db.profiles.push(profile);
    db.credentials[profile.email.toLowerCase()] = password;
    db.presence.push({
      employeeId: profile.id,
      status: 'off_shift',
      workMode: profile.workMode,
      updatedAt: nowIso()
    });
    db.leaveEntitlements.push(
      { employeeId: profile.id, year, type: 'annual', days: 25 },
      { employeeId: profile.id, year, type: 'sick', days: 10 },
      { employeeId: profile.id, year, type: 'parental', days: 20 },
      { employeeId: profile.id, year, type: 'unpaid', days: 15 }
    );
    const record = db.invitations.find((i) => i.id === invitation.id);
    if (record) record.status = 'accepted';

    const systemSession: Session = {
      userId: profile.id,
      email: profile.email,
      role: profile.role,
      issuedAt: nowIso()
    };
    recordAudit(db, systemSession, 'invitation.accepted', 'invitation', invitation.id, { email: profile.email });
    notifyAdmins(
      db,
      'invitation_accepted',
      `${profile.fullName} joined`,
      `${profile.jobTitle} · ${profile.department} has activated their account.`,
      '/employees'
    );
  });
}

export function departmentsOf(profiles: Profile[]): string[] {
  return Array.from(new Set(profiles.map((p) => p.department))).sort();
}