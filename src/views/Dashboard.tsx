'use client';

import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { AdminDashboard } from '../components/dashboard/AdminDashboard';
import { EmployeeDashboard } from '../components/dashboard/EmployeeDashboard';

export function Dashboard() {
  const { isAdmin } = useAuth();
  return isAdmin ? <AdminDashboard /> : <EmployeeDashboard />;
}