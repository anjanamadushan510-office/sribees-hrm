'use client';

import React from 'react';
import { RequireAuth, RequireAdmin } from '../../../components/layout/RouteGuards';
import { AppShell } from '../../../components/layout/AppShell';
import { EmployeeProfile } from '../../../views/EmployeeProfile';

export default function EmployeeDetailPage() {
  return (
    <RequireAuth>
      <AppShell>
        <RequireAdmin>
          <EmployeeProfile />
        </RequireAdmin>
      </AppShell>
    </RequireAuth>
  );
}
