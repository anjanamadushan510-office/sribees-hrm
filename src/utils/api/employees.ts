import type { EmploymentStatus, Invitation, Profile, Role, Session, WorkMode } from '../../types';
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
  requireSession } from
'../policies';
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
  await sleep();
  const search = filter.search?.trim().toLowerCase() ?? '';
  return getDb().
  profiles.filter((p) => filter.department && filter.department !== 'all' ? p.department === filter.department : true).
  filter((p) => filter.status && filter.status !== 'all' ? p.status === filter.status : true).
  filter((p) => filter.workMode && filter.workMode !== 'all' ? p.workMode === filter.workMode : true).
  filter((p) =>
  search ? `${p.fullName} ${p.email} ${p.jobTitle} ${p.department}`.toLowerCase().includes(search) : true
  ).
  map((p) => redactProfile(active, p)).
  sort((a, b) => a.fullName.localeCompare(b.fullName));
}

export async function getEmployee(session: Session | null, employeeId: string): Promise<Profile> {
  const active = requireSession(session);
  await sleep(200);
  return redactProfile(active, getProfileOrThrow(employeeId));
}

/** Employees may edit a whitelisted subset of their own row; HR may edit any row. */
export async function updateEmployeeProfile(
session: Session | null,
employeeId: string,
input: ProfileInput)
: Promise<Profile> {
  const active = requireSelfOrAdmin(session, employeeId);
  assertProfileFieldsAllowed(active, employeeId, Object.keys(input));
  const errors = validateProfile(input);
  if (hasErrors(errors)) throw new ValidationError(errors);
  await sleep();

  return mutate((db) => {
    const profile = db.profiles.find((p) => p.id === employeeId);
    if (!profile) throw new NotFoundError('Employee not found.');
    profile.phone = input.phone.trim();
    profile.location = input.location.trim();
    profile.timezone = input.timezone.trim();
    profile.emergencyContact = input.emergencyContact.trim();
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
input: EmploymentInput)
: Promise<Profile> {
  const active = requireAdmin(session);
  const errors: Record<string, string> = {};
  if (!input.jobTitle.trim()) errors.jobTitle = 'Job title is required.';
  if (!input.department.trim()) errors.department = 'Department is required.';
  if (!['office', 'remote', 'hybrid'].includes(input.workMode)) errors.workMode = 'Choose a work mode.';
  if (!['admin', 'employee'].includes(input.role)) errors.role = 'Choose a valid role.';
  if (hasErrors(errors)) throw new ValidationError(errors);
  await sleep();

  return mutate((db) => {
    const profile = db.profiles.find((p) => p.id === employeeId);
    if (!profile) throw new NotFoundError('Employee not found.');

    // Guard against locking the organisation out of HR entirely.
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
status: EmploymentStatus)
: Promise<Profile> {
  const active = requireAdmin(session);
  if (active.userId === employeeId) throw new ForbiddenError('You cannot change your own account status.');
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
  await sleep(220);
  const now = Date.now();
  return getDb().
  invitations.map((invite) =>
  invite.status === 'pending' && new Date(invite.expiresAt).getTime() < now ?
  { ...invite, status: 'expired' as const } :
  invite
  ).
  sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function inviteEmployee(session: Session | null, input: InviteInput): Promise<Invitation> {
  const active = requireAdmin(session);
  const errors = validateInvite(input);
  if (hasErrors(errors)) throw new ValidationError(errors);
  await sleep(380);

  const email = input.email.trim().toLowerCase();
  return mutate((db) => {
    if (db.profiles.some((p) => p.email.toLowerCase() === email)) {
      throw new ConflictError('Someone with that email already has an account.');
    }
    if (db.invitations.some((i) => i.email.toLowerCase() === email && i.status === 'pending')) {
      throw new ConflictError('There is already a pending invitation for that email.');
    }
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
      createdAt: nowIso(),
      expiresAt: new Date(Date.now() + 7 * 86400_000).toISOString()
    };
    db.invitations.unshift(invitation);
    recordAudit(db, active, 'invitation.sent', 'invitation', invitation.id, { email, role: input.role });
    notifyAdmins(
      db,
      'invitation_sent',
      `Invitation sent to ${invitation.fullName}`,
      `${invitation.jobTitle} · ${invitation.department}. Expires in 7 days.`,
      '/employees',
      active.userId
    );
    return invitation;
  });
}

export async function revokeInvitation(session: Session | null, invitationId: string): Promise<void> {
  const active = requireAdmin(session);
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

/**
 * Accepting an invitation is unauthenticated by design — the single-use token is
 * the credential, and the role always comes from the invitation row, never from
 * anything the browser submits.
 */
export async function acceptInvitation(token: string, password: string, confirm: string): Promise<void> {
  const errors: Record<string, string> = {};
  if (password.length < 8) errors.password = 'Choose a password with at least 8 characters.';
  if (password !== confirm) errors.confirm = 'Passwords do not match.';
  if (hasErrors(errors)) throw new ValidationError(errors);

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