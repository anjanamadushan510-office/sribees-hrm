'use client';

import React from 'react';
import { RequireAuth, RequireAdmin } from '../../components/layout/RouteGuards';
import { AppShell } from '../../components/layout/AppShell';
import { Security } from '../../views/Security';

export default function SecurityPage() {
  return (
    <RequireAuth>
      <AppShell>
        <RequireAdmin>
          <Security />
        </RequireAdmin>
      </AppShell>
    </RequireAuth>
  );
}
