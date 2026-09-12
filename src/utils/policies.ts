import type { Profile, Session } from '../types';
import { getDb } from './store';

/**
 * Authorization layer. Every service function routes through these guards, and
 * each guard is a 1:1 mirror of the Postgres RLS policy of the same name in
 * supabase/migrations. The UI never decides what a user may do — it only asks.
 */

export class AuthError extends Error {
  code = 'UNAUTHENTICATED' as const;
  constructor(message = 'Your session has expired. Sign in again.') {
    super(message);
    this.name = 'AuthError';
  }
}

export class ForbiddenError extends Error {
  code = 'FORBIDDEN' as const;
  constructor(message = 'You do not have permission to do that.') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends Error {
  code = 'NOT_FOUND' as const;
  constructor(message = 'That record does not exist.') {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends Error {
  code = 'VALIDATION' as const;
  fields: Record<string, string>;
  constructor(fields: Record<string, string>, message = 'Please fix the highlighted fields.') {
    super(message);
    this.name = 'ValidationError';
    this.fields = fields;
  }
}

export class ConflictError extends Error {
  code = 'CONFLICT' as const;
  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}

export function requireSession(session: Session | null): Session {
  if (!session) throw new AuthError();
  const profile = getDb().profiles.find((p) => p.id === session.userId);
  if (!profile) throw new AuthError();
  if (profile.status === 'suspended') {
    throw new ForbiddenError('This account is suspended. Contact People Operations.');
  }
  // The role always comes from the database row, never from the client session.
  return { ...session, role: profile.role, email: profile.email };
}

export function isAdmin(session: Session | null): boolean {
  if (!session) return false;
  const profile = getDb().profiles.find((p) => p.id === session.userId);
  return profile?.role === 'admin' && profile.status === 'active';
}

export function requireAdmin(session: Session | null): Session {
  const active = requireSession(session);
  if (!isAdmin(active)) throw new ForbiddenError('Only HR administrators can perform this action.');
  return active;
}

/** admin → anyone; employee → self only. */
export function requireSelfOrAdmin(session: Session | null, employeeId: string): Session {
  const active = requireSession(session);
  if (active.userId === employeeId) return active;
  if (isAdmin(active)) return active;
  throw new ForbiddenError('You can only access your own records.');
}

/** Fields an employee may change on their own profile. Everything else is HR-only. */
export const SELF_EDITABLE_PROFILE_FIELDS = ['phone', 'location', 'timezone', 'emergencyContact', 'workMode'] as const;

export type SelfEditableField = (typeof SELF_EDITABLE_PROFILE_FIELDS)[number];

export function assertProfileFieldsAllowed(session: Session, employeeId: string, keys: string[]): void {
  if (isAdmin(session)) return;
  if (session.userId !== employeeId) throw new ForbiddenError('You can only edit your own profile.');
  const illegal = keys.filter((key) => !SELF_EDITABLE_PROFILE_FIELDS.includes(key as SelfEditableField));
  if (illegal.length > 0) {
    throw new ForbiddenError(`Only HR can change: ${illegal.join(', ')}.`);
  }
}

/** Directory rows are readable by all signed-in staff; sensitive columns are not. */
export function redactProfile(session: Session, profile: Profile): Profile {
  if (isAdmin(session) || session.userId === profile.id) return profile;
  return { ...profile, phone: '', emergencyContact: '', hireDate: '' };
}

export function getProfileOrThrow(id: string): Profile {
  const profile = getDb().profiles.find((p) => p.id === id);
  if (!profile) throw new NotFoundError('Employee not found.');
  return profile;
}

export function toMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return 'Something went wrong. Please try again.';
}