'use client';

import React from 'react';
import { RequireAuth } from '../../components/layout/RouteGuards';
import { AppShell } from '../../components/layout/AppShell';
import { Leave } from '../../views/Leave';

export default function LeavePage() {
  return (
    <RequireAuth>
      <AppShell>
        <Leave />
      </AppShell>
    </RequireAuth>
  );
}
