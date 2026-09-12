'use client';

import React from 'react';
import { RequireAuth } from '../../components/layout/RouteGuards';
import { AppShell } from '../../components/layout/AppShell';
import { Notifications } from '../../views/Notifications';

export default function NotificationsPage() {
  return (
    <RequireAuth>
      <AppShell>
        <Notifications />
      </AppShell>
    </RequireAuth>
  );
}
