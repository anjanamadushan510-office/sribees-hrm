import type { Profile, Session } from '../../types';
import { AuthError, ForbiddenError, ValidationError } from '../policies';
import { getDb, mutate, nowIso, readSessionToken, sleep, writeSessionToken } from '../store';
import { hasErrors, validateCredentials } from '../validation';
import { recordAudit } from './audit';

/**
 * Demo auth adapter. In production this module is the ONLY file that changes:
 * signIn/signOut/restoreSession map directly onto supabase.auth.signInWithPassword,
 * signOut and getSession. Passwords are never compared in the browser there.
 */

function buildSession(profile: Profile): Session {
  return { userId: profile.id, email: profile.email, role: profile.role, issuedAt: nowIso() };
}

export async function signIn(email: string, password: string): Promise<{session: Session;profile: Profile;}> {
  const errors = validateCredentials(email, password);
  if (hasErrors(errors)) throw new ValidationError(errors);
  await sleep(420);

  const normalized = email.trim().toLowerCase();
  const db = getDb();
  const profile = db.profiles.find((p) => p.email.toLowerCase() === normalized);
  const stored = db.credentials[normalized];

  // A single generic message: never reveal whether the address exists.
  if (!profile || !stored || stored !== password) {
    throw new AuthError('Incorrect email or password.');
  }
  if (profile.status === 'suspended') {
    throw new ForbiddenError('This account is suspended. Contact People Operations.');
  }
  if (profile.status === 'invited') {
    throw new ForbiddenError('Finish setting up your account from the invitation link first.');
  }

  const session = buildSession(profile);
  writeSessionToken(profile.id);
  mutate((database) => recordAudit(database, session, 'auth.signed_in', 'profile', profile.id, {}));
  return { session, profile };
}

export async function restoreSession(): Promise<{session: Session;profile: Profile;} | null> {
  await sleep(200);
  const userId = readSessionToken();
  if (!userId) return null;
  const profile = getDb().profiles.find((p) => p.id === userId);
  if (!profile || profile.status !== 'active') {
    writeSessionToken(null);
    return null;
  }
  return { session: buildSession(profile), profile };
}

export async function signOut(session: Session | null): Promise<void> {
  if (session) {
    mutate((db) => recordAudit(db, session, 'auth.signed_out', 'profile', session.userId, {}));
  }
  writeSessionToken(null);
  await sleep(140);
}