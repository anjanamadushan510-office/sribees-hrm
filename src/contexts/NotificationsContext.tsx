'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { AppNotification } from '../types';
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead } from
'../utils/api/notifications';
import { useAuth } from './AuthContext';

interface NotificationsValue {
  items: AppNotification[];
  unread: number;
  loading: boolean;
  error: string | null;
  refresh: () => void;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
}

const NotificationsContext = createContext<NotificationsValue | null>(null);

export function NotificationsProvider({ children }: {children: React.ReactNode;}) {
  const { session, status } = useAuth();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    if (!session) {
      setItems([]);
      return;
    }
    setLoading(true);
    listNotifications(session).
    then((rows) => {
      setItems(rows);
      setError(null);
    }).
    catch(() => setError('Notifications could not be loaded.')).
    finally(() => setLoading(false));
  }, [session]);

  useEffect(() => {
    if (status !== 'authenticated') return undefined;
    refresh();
    const id = window.setInterval(refresh, 20000);
    return () => window.clearInterval(id);
  }, [status, refresh]);

  const markRead = useCallback(
    async (id: string) => {
      await markNotificationRead(session, id);
      setItems((current) => current.map((n) => n.id === id ? { ...n, read: true } : n));
    },
    [session]
  );

  const markAllRead = useCallback(async () => {
    await markAllNotificationsRead(session);
    setItems((current) => current.map((n) => ({ ...n, read: true })));
  }, [session]);

  const value = useMemo<NotificationsValue>(
    () => ({
      items,
      unread: items.filter((n) => !n.read).length,
      loading,
      error,
      refresh,
      markRead,
      markAllRead
    }),
    [items, loading, error, refresh, markRead, markAllRead]
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications(): NotificationsValue {
  const context = useContext(NotificationsContext);
  if (!context) throw new Error('useNotifications must be used inside NotificationsProvider');
  return context;
}