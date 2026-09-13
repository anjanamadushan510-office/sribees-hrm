'use client';

import React, { Suspense } from 'react';
import { RequireAuth } from '../../components/layout/RouteGuards';
import { AppShell } from '../../components/layout/AppShell';
import { Leave } from '../../views/Leave';

export default function LeavePage() {
  return (
    <RequireAuth>
      <AppShell>
        <Suspense fallback={<div className="p-6 text-xs text-ink-faint">Loading leave records...</div>}>
          <Leave />
        </Suspense>
      </AppShell>
    </RequireAuth>
  );
}
