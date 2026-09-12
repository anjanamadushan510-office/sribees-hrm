'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { ClockIcon } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useAsync } from '../hooks/useAsync';
import { listAttendance } from '../utils/api/attendance';
import { ClockCard } from '../components/attendance/ClockCard';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { AsyncBoundary, EmptyState } from '../components/ui/States';
import { StatTile } from '../components/dashboard/StatTile';
import { WorkModeBadge } from '../components/ui/Badge';
import { formatDate, formatDuration, formatTime, startOfWeek, toISODate, workedMinutes } from '../utils/time';
import { cn } from '../utils/cn';

type RangeKey = 'week' | 'month' | 'quarter';

const RANGES: Array<{key: RangeKey;label: string;from: () => string;}> = [
{ key: 'week', label: 'This week', from: () => toISODate(startOfWeek()) },
{
  key: 'month',
  label: 'This month',
  from: () => `${toISODate(new Date()).slice(0, 7)}-01`
},
{
  key: 'quarter',
  label: 'Last 90 days',
  from: () => {
    const d = new Date();
    d.setDate(d.getDate() - 90);
    return toISODate(d);
  }
}];


export function Attendance() {
  const { session } = useAuth();
  const [range, setRange] = useState<RangeKey>('week');
  const from = useMemo(() => RANGES.find((r) => r.key === range)?.from() ?? '', [range]);

  const loader = useCallback(
    () => listAttendance(session, { employeeId: session?.userId ?? '', from }),
    [session, from]
  );
  const state = useAsync(loader, [session?.userId, from]);

  const totals = useMemo(() => {
    const entries = state.data ?? [];
    const minutes = entries.reduce((sum, entry) => sum + workedMinutes(entry), 0);
    const days = entries.length;
    return { minutes, days, avg: days === 0 ? 0 : Math.round(minutes / days) };
  }, [state.data]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight text-ink">My time</h1>
        <p className="mt-1 text-[13px] text-ink-soft">
          Working hours are calculated from clock-in to clock-out, minus recorded breaks.
        </p>
      </header>

      <ClockCard onChange={state.reload} />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile label="Total logged" value={formatDuration(totals.minutes)} hint={RANGES.find((r) => r.key === range)?.label} />
        <StatTile label="Days recorded" value={`${totals.days}`} hint="Entries in this range" />
        <StatTile label="Average day" value={formatDuration(totals.avg)} hint="Excluding breaks" />
      </div>

      <Card>
        <CardHeader
          title="Timesheet"
          description="Every recorded shift, newest first."
          action={
          <div className="flex rounded-md border border-line p-0.5" role="tablist" aria-label="Date range">
              {RANGES.map((option) =>
            <button
              key={option.key}
              type="button"
              role="tab"
              aria-selected={range === option.key}
              onClick={() => setRange(option.key)}
              className={cn(
                'rounded px-2.5 py-1 text-[12px] font-medium transition-colors duration-150 ease-out',
                range === option.key ? 'bg-brand-50 text-brand-800' : 'text-ink-soft hover:text-ink'
              )}>
              
                  {option.label}
                </button>
            )}
            </div>
          } />
        
        <AsyncBoundary
          state={state}
          loadingRows={6}
          empty={
          <EmptyState
            title="No hours recorded yet"
            description="Clock in to start building your timesheet for this period."
            icon={<ClockIcon className="h-5 w-5" />} />

          }>
          
          {(entries) =>
          <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] border-collapse text-left text-[13px]">
                <thead>
                  <tr className="border-b border-line text-[12px] uppercase tracking-wide text-ink-soft">
                    <th scope="col" className="px-5 py-2.5 font-medium">Date</th>
                    <th scope="col" className="px-5 py-2.5 font-medium">In</th>
                    <th scope="col" className="px-5 py-2.5 font-medium">Out</th>
                    <th scope="col" className="px-5 py-2.5 font-medium">Break</th>
                    <th scope="col" className="px-5 py-2.5 font-medium">Worked</th>
                    <th scope="col" className="px-5 py-2.5 font-medium">Mode</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) =>
                <tr key={entry.id} className="border-b border-line last:border-b-0">
                      <td className="px-5 py-3 font-medium text-ink">{formatDate(entry.date)}</td>
                      <td className="px-5 py-3 font-mono text-ink-soft">{formatTime(entry.clockIn)}</td>
                      <td className="px-5 py-3 font-mono text-ink-soft">
                        {entry.clockOut ? formatTime(entry.clockOut) : <span className="text-success-ink">Open</span>}
                      </td>
                      <td className="px-5 py-3 text-ink-soft">{entry.breakMinutes}m</td>
                      <td className="px-5 py-3 font-medium text-ink">{formatDuration(workedMinutes(entry))}</td>
                      <td className="px-5 py-3">
                        <WorkModeBadge mode={entry.workMode} />
                      </td>
                    </tr>
                )}
                </tbody>
              </table>
            </div>
          }
        </AsyncBoundary>
        {state.data && state.data.length > 0 ?
        <CardBody className="border-t border-line text-[12px] text-ink-soft">
            Showing {state.data.length} entr{state.data.length === 1 ? 'y' : 'ies'} · {formatDuration(totals.minutes)}{' '}
            total
          </CardBody> :
        null}
      </Card>
    </div>);

}