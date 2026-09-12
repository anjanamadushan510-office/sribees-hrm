'use client';

import React from 'react';
import { RequireAuth } from '../../components/layout/RouteGuards';
import { AppShell } from '../../components/layout/AppShell';
import { Team } from '../../views/Team';

export default function TeamPage() {
  return (
    <RequireAuth>
      <AppShell>
        <Team />
      </AppShell>
    </RequireAuth>
  );
}
