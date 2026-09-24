"use client";

import React, { useCallback } from "react";
import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowRightIcon, CalendarDaysIcon, UsersIcon } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useAsync } from "../../hooks/useAsync";
import { getEmployeeStats } from "../../utils/api/stats";
import { LEAVE_TYPE_LABEL } from "../../utils/api/leave";
import { formatDate, formatDuration } from "../../utils/time";
import { Card, CardBody, CardHeader } from "../ui/Card";
import { AsyncBoundary, EmptyState } from "../ui/States";
import { ClockCard } from "../attendance/ClockCard";
import { StatTile } from "./StatTile";

export function EmployeeDashboard() {
  const { session, profile } = useAuth();
  const loader = useCallback(() => getEmployeeStats(session), [session]);
  const state = useAsync(loader, [session?.userId]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight text-ink">
          Hello, {profile?.fullName.split(" ")[0]}
        </h1>
        <p className="mt-1 text-[13px] text-ink-soft">
          Your time, your balances, and what is coming up.
        </p>
      </header>

      <ClockCard onChange={state.reload} />

      <AsyncBoundary state={state} loadingRows={4}>
        {(stats) => (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <div className="space-y-6">
              <div className="grid gap-3 sm:grid-cols-3">
                <StatTile
                  label="Today"
                  value={formatDuration(stats.todayMinutes)}
                  hint="Recorded so far"
                />
                <StatTile
                  label="This week"
                  value={formatDuration(stats.weekMinutes)}
                  hint={`Target ${stats.weekTarget / 60}h`}
                />

                <StatTile
                  label="This month"
                  value={formatDuration(stats.monthMinutes)}
                  hint="Approved and recorded"
                />
              </div>

              <Card>
                <CardHeader
                  title="Your hours"
                  description="Working hours you recorded over the last 14 days."
                  action={
                    <Link
                      href="/attendance"
                      className="inline-flex items-center gap-1 text-[13px] font-medium text-brand-700 hover:underline"
                    >
                      Timesheet <ArrowRightIcon className="h-3.5 w-3.5" />
                    </Link>
                  }
                />

                <CardBody className="pl-1 pr-3">
                  <div className="h-52 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={stats.trend}
                        margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
                      >
                        <CartesianGrid stroke="#e5e0cf" vertical={false} />
                        <XAxis
                          dataKey="label"
                          tickLine={false}
                          axisLine={false}
                          tick={{ fontSize: 11, fill: "#8c8a83" }}
                          interval={1}
                        />

                        <YAxis
                          tickLine={false}
                          axisLine={false}
                          tick={{ fontSize: 11, fill: "#8c8a83" }}
                          width={30}
                        />
                        <Tooltip
                          cursor={{ fill: "#FCF9EA" }}
                          contentStyle={{
                            borderRadius: 8,
                            border: "1px solid #e5e0cf",
                            fontSize: 12,
                          }}
                          formatter={(value: number) => [`${value}h`, "Logged"]}
                          labelFormatter={(_, payload) =>
                            payload && payload.length > 0
                              ? formatDate(String(payload[0].payload.date))
                              : ""
                          }
                        />

                        <Bar
                          dataKey="hours"
                          fill="#FFA239"
                          radius={[3, 3, 0, 0]}
                          maxBarSize={26}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardBody>
              </Card>
            </div>

            <div className="space-y-6">
              <Card>
                <CardHeader
                  title="Leave balances"
                  description="Remaining days this year."
                  action={
                    <Link
                      href="/leave"
                      className="text-[13px] font-medium text-brand-700 hover:underline"
                    >
                      Request
                    </Link>
                  }
                />

                <CardBody className="space-y-3">
                  {stats.balances.map((balance) => (
                    <div key={balance.type}>
                      <div className="flex items-baseline justify-between text-[13px]">
                        <span className="text-ink">
                          {LEAVE_TYPE_LABEL[balance.type]}
                        </span>
                        <span className="font-medium text-ink">
                          {balance.remainingDays}
                          <span className="text-ink-soft">
                            {" "}
                            / {balance.entitlementDays} days
                          </span>
                        </span>
                      </div>
                      <div className="mt-1 flex h-1.5 w-full overflow-hidden rounded-full bg-canvas">
                        <div
                          className="h-full bg-brand-600"
                          style={{
                            width: `${(balance.approvedDays / Math.max(1, balance.entitlementDays)) * 100}%`,
                          }}
                        />

                        <div
                          className="h-full bg-warn/60"
                          style={{
                            width: `${(balance.pendingDays / Math.max(1, balance.entitlementDays)) * 100}%`,
                          }}
                        />
                      </div>
                      {balance.pendingDays > 0 ? (
                        <p className="mt-1 text-[11px] text-warn-ink">
                          {balance.pendingDays} day(s) awaiting approval
                        </p>
                      ) : null}
                    </div>
                  ))}
                </CardBody>
              </Card>

              {/*               <Card>
                <CardHeader title="Coming up" />
                {stats.upcomingLeave.length === 0 ?
              <EmptyState
                title="No approved leave booked"
                description="When HR approves a request it will appear here."
                icon={<CalendarDaysIcon className="h-5 w-5" />} /> :


              <ul>
                    {stats.upcomingLeave.map((leave) =>
                <li key={leave.id} className="border-b border-line px-5 py-3 last:border-b-0">
                        <p className="text-[13px] font-medium text-ink">{LEAVE_TYPE_LABEL[leave.type]}</p>
                        <p className="mt-0.5 text-[12px] text-ink-soft">
                          {formatDate(leave.startDate)} → {formatDate(leave.endDate)} · {leave.days} day
                          {leave.days === 1 ? '' : 's'}
                        </p>
                      </li>
                )}
                  </ul>
              }
              </Card>

              <Card>
                <CardBody className="flex items-center justify-between gap-3">
                  <p className="flex items-center gap-1.5 text-[13px] text-ink">
                    <UsersIcon className="h-3.5 w-3.5 text-ink-soft" />
                    <span className="font-medium">{stats.teammatesWorking}</span> teammates on the clock
                  </p>
                  <Link href="/team" className="shrink-0 text-[13px] font-medium text-brand-700 hover:underline">
                    See who
                  </Link>
                </CardBody>
              </Card> */}
            </div>
          </div>
        )}
      </AsyncBoundary>
    </div>
  );
}
