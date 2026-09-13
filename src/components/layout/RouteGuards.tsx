'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldAlertIcon } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';


export function SessionSplash() {
  return (
    <div className="relative flex min-h-screen w-full flex-col items-center justify-center bg-canvas px-4" role="status" aria-live="polite">
      {/* Ambient background glow */}
      <div className="pointer-events-none absolute h-72 w-72 rounded-full bg-brand-200/40 blur-3xl" aria-hidden />

      {/* Main Loading Card Container */}
      <div className="relative z-10 flex flex-col items-center text-center">
        {/* Animated Branded Logo Icon Box */}
        <div className="relative mb-5 flex h-20 w-20 items-center justify-center rounded-2xl border border-line bg-surface p-3 shadow-pop animate-pulse">
          <img src="/logo.png" alt="Sribees HRM Logo" className="h-12 w-auto object-contain" />
        </div>

        {/* App Title & Subtitle */}
        <h2 className="text-xl font-bold tracking-tight text-ink">Sribees HRM</h2>
        <p className="mt-1 text-xs font-medium text-ink-soft">Restoring your secure session…</p>

        {/* Sleek Animated Progress Indicator */}
        <div className="mt-6 h-1.5 w-52 overflow-hidden rounded-full bg-brand-100">
          <div className="h-full w-full origin-left animate-pulse bg-brand-500 rounded-full" />
        </div>

        {/* Status Indicator */}
        <div className="mt-8 flex items-center gap-2 rounded-full border border-line bg-surface/80 px-3.5 py-1.5 text-[11px] font-medium text-ink-faint shadow-card">
          <span className="h-2 w-2 rounded-full bg-success animate-ping" />
          <span>Encrypted Session Active</span>
        </div>
      </div>
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