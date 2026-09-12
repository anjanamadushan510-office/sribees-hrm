'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { BellIcon } from 'lucide-react';
import { useNotifications } from '../contexts/NotificationsContext';
import { Card, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { EmptyState, ErrorState, LoadingState } from '../components/ui/States';
import { relativeTime } from '../utils/time';
import { cn } from '../utils/cn';

export function Notifications() {
  const { items, unread, loading, error, refresh, markRead, markAllRead } = useNotifications();
  const router = useRouter();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight text-ink">Notifications</h1>
        <p className="mt-1 text-[13px] text-ink-soft">
          Everything that needs your attention. Only notifications addressed to you are ever delivered.
        </p>
      </header>

      <Card>
        <CardHeader
          title={unread > 0 ? `${unread} unread` : 'All caught up'}
          action={
          unread > 0 ?
          <Button variant="secondary" size="sm" onClick={() => void markAllRead()}>
                Mark all read
              </Button> :
          null
          } />
        
        {loading && items.length === 0 ?
        <LoadingState rows={4} /> :
        error ?
        <ErrorState message={error} onRetry={refresh} /> :
        items.length === 0 ?
        <EmptyState
          title="No notifications yet"
          description="Leave decisions, invitations and reminders will show up here."
          icon={<BellIcon className="h-5 w-5" />} /> :


        <ul className="divide-y divide-line">
            {items.map((item) =>
          <li key={item.id}>
                <button
              type="button"
              onClick={() => {
                void markRead(item.id);
                router.push(item.link);
              }}
              className="flex w-full gap-3 px-5 py-4 text-left transition-colors duration-150 ease-out hover:bg-canvas">
              
                  <span
                className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', item.read ? 'bg-line' : 'bg-brand-600')}
                aria-hidden />
              
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-medium text-ink">{item.title}</span>
                    <span className="mt-0.5 block text-[13px] leading-snug text-ink-soft">{item.body}</span>
                  </span>
                  <span className="shrink-0 text-[12px] text-ink-faint">{relativeTime(item.createdAt)}</span>
                </button>
              </li>
          )}
          </ul>
        }
      </Card>
    </div>);

}