'use client';

import React, { useCallback } from 'react';
import Link from 'next/link';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowRightIcon, CalendarCheckIcon, MailIcon, UsersIcon, WifiIcon } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useAsync } from '../../hooks/useAsync';
import { getAdminStats } from '../../utils/api/stats';
import { LEAVE_TYPE_LABEL } from '../../utils/api/leave';
import { formatDate } from '../../utils/time';
import { Card, CardBody, CardHeader } from '../ui/Card';
import { AsyncBoundary, EmptyState } from '../ui/States';
import { StatTile } from './StatTile';
import { Badge } from '../ui/Badge';

export function AdminDashboard() {
  const { session, profile } = useAuth();
  const loader = useCallback(() => getAdminStats(session), [session]);
  const state = useAsync(loader, [session?.userId]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight text-ink">
          Good day, {profile?.fullName.split(' ')[0]}
        </h1>
        <p className="mt-1 text-[13px] text-ink-soft">Live view of attendance, leave and headcount across Northwind.</p>
      </header>

      <AsyncBoundary state={state} loadingRows={5}>
        {(stats) =>
        <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <div className="space-y-6">
              <section className="rounded-xl border border-line bg-surface p-5 shadow-card sm:p-6">
                <p className="text-[12px] font-medium uppercase tracking-wide text-ink-soft">Attendance today</p>
                <div className="mt-2 flex flex-wrap items-end gap-x-4 gap-y-2">
                  <p className="text-5xl font-semibold tracking-tight text-ink">{stats.attendanceRate}%</p>
                  <p className="pb-1.5 text-[13px] text-ink-soft">
                    {stats.activeToday} of {Math.max(1, stats.headcount - stats.onLeaveToday)} expected employees have
                    clocked in
                  </p>
                </div>
                <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-canvas">
                  <div
                  className="h-full rounded-full bg-brand-600 transition-[width] duration-300 ease-out"
                  style={{ width: `${Math.min(100, stats.attendanceRate)}%` }} />
                
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <StatTile
                  label="Headcount"
                  value={`${stats.headcount}`}
                  hint="Active employees"
                  icon={<UsersIcon className="h-3.5 w-3.5" />} />
                
                  <StatTile
                  label="Remote now"
                  value={`${stats.remoteToday}`}
                  hint="Working outside the office"
                  icon={<WifiIcon className="h-3.5 w-3.5" />} />
                
                  <StatTile
                  label="On leave"
                  value={`${stats.onLeaveToday}`}
                  hint="Approved absence today"
                  icon={<CalendarCheckIcon className="h-3.5 w-3.5" />} />
                
                </div>
              </section>

              <Card>
                <CardHeader
                title="Hours logged"
                description="Total recorded working hours across the company, last 14 days."
                action={<Badge tone="neutral">{stats.avgHoursThisWeek}h avg / person this week</Badge>} />
              
                <CardBody className="pl-1 pr-3">
                  <div className="h-56 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={stats.trend} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                        <defs>
                          <linearGradient id="hoursFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#FFA239" stopOpacity={0.25} />
                            <stop offset="100%" stopColor="#FFA239" stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid stroke="#e5e0cf" vertical={false} />
                        <XAxis
                        dataKey="label"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontSize: 11, fill: '#8c8a83' }}
                        interval={1} />
                      
                        <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#8c8a83' }} width={34} />
                        <Tooltip
                        contentStyle={{
                          borderRadius: 8,
                          border: '1px solid #e5e0cf',
                          fontSize: 12,
                          boxShadow: '0 12px 32px -12px rgba(28,27,24,0.28)'
                        }}
                        formatter={(value: number) => [`${value}h`, 'Logged']}
                        labelFormatter={(_, payload) =>
                        payload && payload.length > 0 ? formatDate(String(payload[0].payload.date)) : ''
                        } />
                      
                        <Area
                        type="monotone"
                        dataKey="hours"
                        stroke="#FFA239"
                        strokeWidth={2}
                        fill="url(#hoursFill)" />
                      
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardBody>
              </Card>
            </div>

            <div className="space-y-6">
              <Card>
                <CardHeader
                title="Awaiting your decision"
                description={`${stats.pendingLeave} leave request${stats.pendingLeave === 1 ? '' : 's'} pending.`}
                action={
                <Link
                  href="/leave"
                  className="inline-flex items-center gap-1 text-[13px] font-medium text-brand-700 hover:underline">
                  
                      Review <ArrowRightIcon className="h-3.5 w-3.5" />
                    </Link>
                } />
              
                {stats.pendingQueue.length === 0 ?
              <EmptyState title="Nothing to review" description="Every leave request has been decided." /> :

              <ul>
                    {stats.pendingQueue.map(({ request, employeeName }) =>
                <li key={request.id} className="border-b border-line px-5 py-3 last:border-b-0">
                        <p className="text-[13px] font-medium text-ink">{employeeName}</p>
                        <p className="mt-0.5 text-[12px] text-ink-soft">
                          {LEAVE_TYPE_LABEL[request.type]} · {request.days} day{request.days === 1 ? '' : 's'} ·{' '}
                          {formatDate(request.startDate)}
                        </p>
                      </li>
                )}
                  </ul>
              }
              </Card>

              <Card>
                <CardHeader title="Headcount by department" />
                <CardBody className="space-y-2.5">
                  {stats.departmentSplit.map((row) =>
                <div key={row.department}>
                      <div className="flex items-baseline justify-between text-[13px]">
                        <span className="text-ink">{row.department}</span>
                        <span className="font-medium text-ink-soft">{row.count}</span>
                      </div>
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-canvas">
                        <div
                      className="h-full rounded-full bg-brand-400"
                      style={{ width: `${row.count / Math.max(1, stats.headcount) * 100}%` }} />
                    
                      </div>
                    </div>
                )}
                </CardBody>
              </Card>

              <Card>
                <CardBody className="flex items-center justify-between gap-3">
                  <div>
                    <p className="flex items-center gap-1.5 text-[13px] font-medium text-ink">
                      <MailIcon className="h-3.5 w-3.5 text-ink-soft" />
                      {stats.pendingInvites} pending invitation{stats.pendingInvites === 1 ? '' : 's'}
                    </p>
                    <p className="mt-0.5 text-[12px] text-ink-soft">Invitations expire seven days after they are sent.</p>
                  </div>
                  <Link
                  href="/employees"
                  className="shrink-0 text-[13px] font-medium text-brand-700 hover:underline">
                  
                    Manage
                  </Link>
                </CardBody>
              </Card>
            </div>
          </div>
        }
      </AsyncBoundary>
    </div>);

}