'use client';

import React from 'react';
import { RequireAuth } from '../components/layout/RouteGuards';
import { AppShell } from '../components/layout/AppShell';
import { Dashboard } from '../views/Dashboard';

export default function HomePage() {
  return (
    <RequireAuth>
      <AppShell>
        <Dashboard />
      </AppShell>
    </RequireAuth>
  );
}
