'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldAlertIcon } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { Spinner } from '../ui/States';

export function SessionSplash() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-canvas" role="status" aria-live="polite">
      <span className="flex items-center gap-2 text-sm text-ink-soft">
        <Spinner /> Restoring your session…
      </span>
    </div>
  );
}

/** Route-level gate. It is a convenience only — every service re-checks authorization. */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === 'anonymous') {
      router.replace('/login');
    }
  }, [status, router]);

  if (status === 'loading') return <SessionSplash />;
  if (status === 'anonymous') return <SessionSplash />;
  return <>{children}</>;
}

export function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { status, isAdmin } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === 'anonymous') {
      router.replace('/login');
    }
  }, [status, router]);

  if (status === 'loading') return <SessionSplash />;
  if (status === 'anonymous') return <SessionSplash />;
  if (!isAdmin) return <ForbiddenScreen />;
  return <>{children}</>;
}

export function ForbiddenScreen() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-xl border border-line bg-surface px-6 py-14 text-center shadow-card">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-warn-soft text-warn-ink">
        <ShieldAlertIcon className="h-5 w-5" />
      </span>
      <h1 className="text-base font-semibold text-ink">This area is for HR administrators</h1>
      <p className="text-[13px] text-ink-soft">
        Your account does not have permission to view it. If you think that is wrong, contact People Operations.
      </p>
    </div>);

}