'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Profile, Session } from '../types';
import { restoreSession, signIn as signInService, signOut as signOutService } from '../utils/api/auth';
import { getEmployee } from '../utils/api/employees';

type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

interface AuthValue {
  status: AuthStatus;
  session: Session | null;
  profile: Profile | null;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: {children: React.ReactNode;}) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    let cancelled = false;
    restoreSession().
    then((restored) => {
      if (cancelled) return;
      if (restored) {
        setSession(restored.session);
        setProfile(restored.profile);
        setStatus('authenticated');
      } else {
        setStatus('anonymous');
      }
    }).
    catch(() => {
      if (!cancelled) setStatus('anonymous');
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const result = await signInService(email, password);
    setSession(result.session);
    setProfile(result.profile);
    setStatus('authenticated');
  }, []);

  const signOut = useCallback(async () => {
    await signOutService(session);
    setSession(null);
    setProfile(null);
    setStatus('anonymous');
  }, [session]);

  const refreshProfile = useCallback(async () => {
    if (!session) return;
    const fresh = await getEmployee(session, session.userId);
    setProfile(fresh);
  }, [session]);

  const value = useMemo<AuthValue>(
    () => ({
      status,
      session,
      profile,
      isAdmin: profile?.role === 'admin' && profile.status === 'active',
      signIn,
      signOut,
      refreshProfile
    }),
    [status, session, profile, signIn, signOut, refreshProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}