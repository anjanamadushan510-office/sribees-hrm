import type { Profile, Session } from '../../types';
import { getSupabase } from '../../lib/supabase/client';
import { mapProfileFromDb } from '../../types/database.types';
import { AuthError, ForbiddenError, ValidationError, requireSession } from '../policies';
import { getDb, mutate, nowIso, readSessionToken, sleep, writeSessionToken } from '../store';
import { hasErrors, validateCredentials, validatePasswordChange } from '../validation';
import { recordAudit } from './audit';

function buildSession(profile: Profile): Session {
  return { userId: profile.id, email: profile.email, role: profile.role, issuedAt: nowIso() };
}

export async function signIn(email: string, password: string): Promise<{ session: Session; profile: Profile }> {
  const errors = validateCredentials(email, password);
  if (hasErrors(errors)) throw new ValidationError(errors);

  const supabase = getSupabase();
  if (supabase) {
    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password
      });

      if (!authError && authData.user) {
        const { data: profileRow, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authData.user.id)
          .single();

        if (profileError || !profileRow) {
          throw new AuthError('User profile not found in database.');
        }

        const profile = mapProfileFromDb(profileRow);

        if (profile.status === 'suspended') {
          await supabase.auth.signOut();
          throw new ForbiddenError('This account is suspended. Contact People Operations.');
        }

        if (profile.status === 'invited') {
          await supabase.auth.signOut();
          throw new ForbiddenError('Finish setting up your account from the invitation link first.');
        }

        const session = buildSession(profile);
        return { session, profile };
      }
    } catch (e) {
      if (e instanceof ForbiddenError || e instanceof ValidationError) {
        throw e;
      }
    }
  }

  // Demo / Local storage fallback mode
  await sleep(420);
  const normalized = email.trim().toLowerCase();
  const db = getDb();
  const profile = db.profiles.find((p) => p.email.toLowerCase() === normalized);
  const stored = db.credentials[normalized];

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

export async function restoreSession(): Promise<{ session: Session; profile: Profile } | null> {
  const supabase = getSupabase();
  if (supabase) {
    try {
      const { data: authData } = await supabase.auth.getSession();
      if (authData.session?.user) {
        const { data: profileRow } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authData.session.user.id)
          .single();

        if (profileRow && profileRow.status === 'active') {
          const profile = mapProfileFromDb(profileRow);
          return { session: buildSession(profile), profile };
        }
      }
    } catch {
      // Ignore Supabase restore error and fallback to local storage
    }
  }

  // Demo fallback mode
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

export async function changePassword(
  session: Session | null,
  currentPassword: string,
  newPassword: string,
  confirmPassword: string
): Promise<void> {
  const active = requireSession(session);
  const clientErrors = validatePasswordChange(currentPassword, newPassword, confirmPassword);
  if (hasErrors(clientErrors)) throw new ValidationError(clientErrors);

  const supabase = getSupabase();
  if (supabase) {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      throw new ValidationError({ currentPassword: error.message });
    }
    return;
  }

  // Demo fallback mode
  await sleep(400);
  mutate((db) => {
    const profile = db.profiles.find((p) => p.id === active.userId);
    if (!profile) throw new AuthError('User profile not found.');

    const normalized = profile.email.toLowerCase();
    const stored = db.credentials[normalized];

    if (!stored || stored !== currentPassword) {
      throw new ValidationError({ currentPassword: 'Current password is incorrect.' });
    }

    db.credentials[normalized] = newPassword;
    profile.mustChangePassword = false;
    recordAudit(db, active, 'auth.password_changed', 'profile', profile.id, {});
  });
}

export async function signOut(session: Session | null): Promise<void> {
  const supabase = getSupabase();
  if (supabase) {
    await supabase.auth.signOut();
    return;
  }

  // Demo fallback mode
  if (session) {
    mutate((db) => recordAudit(db, session, 'auth.signed_out', 'profile', session.userId, {}));
  }
  writeSessionToken(null);
  await sleep(140);
}