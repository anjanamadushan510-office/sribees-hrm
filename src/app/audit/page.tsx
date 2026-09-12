'use client';

import React from 'react';
import { RequireAuth, RequireAdmin } from '../../components/layout/RouteGuards';
import { AppShell } from '../../components/layout/AppShell';
import { AuditLog } from '../../views/AuditLog';

export default function AuditPage() {
  return (
    <RequireAuth>
      <AppShell>
        <RequireAdmin>
          <AuditLog />
        </RequireAdmin>
      </AppShell>
    </RequireAuth>
  );
}
