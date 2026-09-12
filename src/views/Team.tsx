'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { UsersIcon } from 'lucide-react';
import type { Presence, WorkMode } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useAsync, useTicker } from '../hooks/useAsync';
import { listPresence, setPresence, setWorkMode } from '../utils/api/attendance';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { AsyncBoundary, EmptyState } from '../components/ui/States';
import { Avatar } from '../components/ui/Avatar';
import { PresenceDot, WorkModeBadge } from '../components/ui/Badge';
import { StatTile } from '../components/dashboard/StatTile';
import { formatDuration, formatTime, relativeTime } from '../utils/time';
import { toMessage } from '../utils/policies';
import { cn } from '../utils/cn';

const STATUS_OPTIONS: Array<{value: Presence['status'];label: string;}> = [
{ value: 'working', label: 'Working' },
{ value: 'on_break', label: 'On break' },
{ value: 'off_shift', label: 'Off shift' }];


export function Team() {
  const { session, profile } = useAuth();
  const tick = useTicker(45000);
  const loader = useCallback(() => listPresence(session), [session]);
  const state = useAsync(loader, [session?.userId, tick]);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<'all' | WorkMode>('all');

  const rows = useMemo(
    () => (state.data ?? []).filter((row) => filter === 'all' ? true : row.presence.workMode === filter),
    [state.data, filter]
  );

  const summary = useMemo(() => {
    const all = state.data ?? [];
    return {
      working: all.filter((r) => r.presence.status === 'working').length,
      remote: all.filter((r) => r.presence.status === 'working' && r.presence.workMode === 'remote').length,
      onLeave: all.filter((r) => r.presence.status === 'on_leave').length
    };
  }, [state.data]);

  const mine = (state.data ?? []).find((row) => row.profile.id === session?.userId);

  const updateStatus = async (status: Presence['status']) => {
    setBusy(true);
    try {
      await setPresence(session, status);
      state.reload();
    } catch (error) {
      toast.error(toMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const updateMode = async (mode: WorkMode) => {
    setBusy(true);
    try {
      await setWorkMode(session, mode);
      toast.success('Your work location was updated.');
      state.reload();
    } catch (error) {
      toast.error(toMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight text-ink">Who is on</h1>
        <p className="mt-1 text-[13px] text-ink-soft">
          Live availability across the remote workforce. Everyone sets their own status.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile label="On the clock" value={`${summary.working}`} hint="Currently working" />
        <StatTile label="Remote" value={`${summary.remote}`} hint="Working outside the office" />
        <StatTile label="On leave" value={`${summary.onLeave}`} hint="Approved absence today" />
      </div>

      <Card>
        <CardHeader title="Your status" description="This is what teammates see next to your name." />
        <CardBody className="flex flex-wrap items-center gap-x-6 gap-y-4">
          <div className="flex items-center gap-3">
            <Avatar name={profile?.fullName ?? '?'} />
            <div>
              <p className="text-[13px] font-medium text-ink">{profile?.fullName}</p>
              {mine ? <PresenceDot status={mine.presence.status} /> : null}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {STATUS_OPTIONS.map((option) =>
            <button
              key={option.value}
              type="button"
              disabled={busy}
              onClick={() => void updateStatus(option.value)}
              className={cn(
                'rounded-md border px-3 py-1.5 text-[13px] font-medium transition-colors duration-150 ease-out disabled:opacity-60',
                mine?.presence.status === option.value ?
                'border-brand-600 bg-brand-50 text-brand-800' :
                'border-line text-ink-soft hover:bg-canvas hover:text-ink'
              )}>
              
                {option.label}
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[13px] text-ink-soft">Working from</span>
            {(['office', 'remote', 'hybrid'] as WorkMode[]).map((mode) =>
            <button
              key={mode}
              type="button"
              disabled={busy}
              onClick={() => void updateMode(mode)}
              className={cn(
                'rounded-md border px-2.5 py-1 text-[12px] font-medium capitalize transition-colors duration-150 ease-out disabled:opacity-60',
                mine?.presence.workMode === mode ?
                'border-brand-600 bg-brand-50 text-brand-800' :
                'border-line text-ink-soft hover:bg-canvas hover:text-ink'
              )}>
              
                {mode}
              </button>
            )}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Everyone"
          action={
          <div className="flex rounded-md border border-line p-0.5">
              {(['all', 'office', 'remote', 'hybrid'] as const).map((option) =>
            <button
              key={option}
              type="button"
              onClick={() => setFilter(option)}
              className={cn(
                'rounded px-2.5 py-1 text-[12px] font-medium capitalize transition-colors duration-150 ease-out',
                filter === option ? 'bg-brand-50 text-brand-800' : 'text-ink-soft hover:text-ink'
              )}>
              
                  {option}
                </button>
            )}
            </div>
          } />
        
        <AsyncBoundary
          state={{ ...state, data: state.data ? rows : null }}
          loadingRows={6}
          empty={
          <EmptyState
            title="Nobody matches that filter"
            description="Try a different work location."
            icon={<UsersIcon className="h-5 w-5" />} />

          }>
          
          {(list) =>
          <ul className="divide-y divide-line">
              {list.map((row) =>
            <li key={row.profile.id} className="flex flex-wrap items-center gap-4 px-5 py-3">
                  <Avatar name={row.profile.fullName} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-ink">{row.profile.fullName}</p>
                    <p className="truncate text-[12px] text-ink-soft">
                      {row.profile.jobTitle} · {row.profile.timezone.replace('_', ' ')}
                    </p>
                  </div>
                  <WorkModeBadge mode={row.presence.workMode} />
                  <div className="w-28">
                    <PresenceDot status={row.presence.status} />
                  </div>
                  <p className="w-32 text-right text-[12px] text-ink-soft">
                    {row.openSince ?
                `Since ${formatTime(row.openSince)} · ${formatDuration(row.todayMinutes)}` :
                row.todayMinutes > 0 ?
                `${formatDuration(row.todayMinutes)} today` :
                `Updated ${relativeTime(row.presence.updatedAt)}`}
                  </p>
                </li>
            )}
            </ul>
          }
        </AsyncBoundary>
      </Card>
    </div>);

}