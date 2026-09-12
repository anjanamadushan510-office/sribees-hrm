'use client';

import React from 'react';
import { RequireAuth } from '../../components/layout/RouteGuards';
import { AppShell } from '../../components/layout/AppShell';
import { Attendance } from '../../views/Attendance';

export default function AttendancePage() {
  return (
    <RequireAuth>
      <AppShell>
        <Attendance />
      </AppShell>
    </RequireAuth>
  );
}
