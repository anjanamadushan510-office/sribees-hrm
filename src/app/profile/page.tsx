'use client';

import React from 'react';
import { RequireAuth } from '../../components/layout/RouteGuards';
import { AppShell } from '../../components/layout/AppShell';
import { MyProfile } from '../../views/MyProfile';

export default function ProfilePage() {
  return (
    <RequireAuth>
      <AppShell>
        <MyProfile />
      </AppShell>
    </RequireAuth>
  );
}
