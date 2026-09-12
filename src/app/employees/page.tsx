'use client';

import React from 'react';
import { RequireAuth, RequireAdmin } from '../../components/layout/RouteGuards';
import { AppShell } from '../../components/layout/AppShell';
import { Employees } from '../../views/Employees';

export default function EmployeesPage() {
  return (
    <RequireAuth>
      <AppShell>
        <RequireAdmin>
          <Employees />
        </RequireAdmin>
      </AppShell>
    </RequireAuth>
  );
}
