import React from 'react';
import type { Metadata } from 'next';
import { Toaster } from 'sonner';
import { AuthProvider } from '../contexts/AuthContext';
import { NotificationsProvider } from '../contexts/NotificationsContext';
import './globals.css';

export const metadata: Metadata = {
  title: 'Northwind People - HRM System',
  description: 'Human Resource Management & Attendance System',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full bg-canvas text-ink antialiased">
        <AuthProvider>
          <NotificationsProvider>
            {children}
            <Toaster position="bottom-right" richColors closeButton />
          </NotificationsProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
