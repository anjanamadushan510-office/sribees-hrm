'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { CalendarPlusIcon, SettingsIcon, ChevronDownIcon, ChevronUpIcon, BookOpenIcon, SparklesIcon } from 'lucide-react';
import type { LeaveStatus, LeaveType } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationsContext';
import { useAsync } from '../hooks/useAsync';
import {
  LEAVE_TYPES,
  LEAVE_TYPE_LABEL,
  cancelLeaveRequest,
  getLeaveBalances,
  listLeaveRequests } from
'../utils/api/leave';
import type { LeaveRequestRow } from '../utils/api/leave';
import { toMessage } from '../utils/policies';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { AsyncBoundary, EmptyState } from '../components/ui/States';
import { LeaveTable } from '../components/leave/LeaveTable';
import { RequestLeaveModal } from '../components/leave/RequestLeaveModal';
import { DecisionModal } from '../components/leave/DecisionModal';
import { ManageEntitlementsModal } from '../components/leave/ManageEntitlementsModal';
import { cn } from '../utils/cn';

export function Leave() {
  const { session, isAdmin } = useAuth();
  const searchParams = useSearchParams();
  const targetRequestId = searchParams ? (searchParams.get('request') || searchParams.get('id')) : null;
  const [handledTarget, setHandledTarget] = useState<string | null>(null);

  const notifications = useNotifications();
  const [requestOpen, setRequestOpen] = useState(false);
  const [manageEntitlementsOpen, setManageEntitlementsOpen] = useState(false);
  const [showGuidelines, setShowGuidelines] = useState(true);
  const [decisionTarget, setDecisionTarget] = useState<{row: LeaveRequestRow;decision: 'approved' | 'rejected';} | null>(
    null
  );
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [status, setStatus] = useState<LeaveStatus | 'all'>('all');
  const [type, setType] = useState<LeaveType | 'all'>('all');

  const requestsLoader = useCallback(() => listLeaveRequests(session, { status, type }), [session, status, type]);
  const requests = useAsync(requestsLoader, [session?.userId, status, type]);

  const balancesLoader = useCallback(
    () => getLeaveBalances(session, session?.userId ?? ''),
    [session]
  );
  const balances = useAsync(balancesLoader, [session?.userId]);

  useEffect(() => {
    if (targetRequestId && requests.data && handledTarget !== targetRequestId) {
      const targetRow = requests.data.find((r) => r.id === targetRequestId);
      if (targetRow) {
        if (isAdmin && targetRow.status === 'pending' && targetRow.employeeId !== session?.userId) {
          setDecisionTarget({ row: targetRow, decision: 'approved' });
        }
        setHandledTarget(targetRequestId);
        setTimeout(() => {
          const el = document.getElementById(`leave-row-${targetRequestId}`);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 300);
      }
    }
  }, [targetRequestId, requests.data, isAdmin, session?.userId, handledTarget]);

  const pending = useMemo(
    () => (requests.data ?? []).filter((row) => row.status === 'pending' && row.employeeId !== session?.userId),
    [requests.data, session?.userId]
  );

  const refreshAll = () => {
    requests.reload();
    balances.reload();
    notifications.refresh();
  };

  const handleCancel = async (row: LeaveRequestRow) => {
    setCancellingId(row.id);
    try {
      await cancelLeaveRequest(session, row.id);
      toast.success('Request cancelled.');
      refreshAll();
    } catch (error) {
      toast.error(toMessage(error));
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-ink">Leave Management</h1>
          <p className="mt-1 text-[13px] text-ink-soft">
            {isAdmin ?
            'Review requests from the team, manage annual leave quotas, and track your time off.' :
            'Request time off and track where each request stands.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isAdmin ? (
            <Button
              variant="secondary"
              icon={<SettingsIcon className="h-4 w-4" />}
              onClick={() => setManageEntitlementsOpen(true)}
            >
              Manage Quotas
            </Button>
          ) : null}
          <Button icon={<CalendarPlusIcon className="h-4 w-4" />} onClick={() => setRequestOpen(true)}>
            Request leave
          </Button>
        </div>
      </header>

      {/* SRIBEES Digital - Leave Types & Guidelines Card */}
      <Card className="overflow-hidden border-brand-200/80 bg-surface shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line/60 bg-brand-50/50 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-500 text-white shadow-xs">
              <BookOpenIcon className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-ink">
                  SRIBEE Digital – Leave Types & Guidelines
                </h2>
                <span className="hidden sm:inline-block rounded-full bg-brand-100 px-2.5 py-0.5 text-[11px] font-semibold text-brand-800">
                  Policy Guide
                </span>
              </div>
              <p className="text-[12.5px] text-ink-soft">
                A quick overview of our leave policies, entitlements, and request workflow.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowGuidelines(!showGuidelines)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:bg-brand-50 hover:text-brand-800"
          >
            {showGuidelines ? (
              <>
                <span>Hide Guidelines</span>
                <ChevronUpIcon className="h-4 w-4 text-ink-soft" />
              </>
            ) : (
              <>
                <span>Show Guidelines</span>
                <ChevronDownIcon className="h-4 w-4 text-ink-soft" />
              </>
            )}
          </button>
        </div>

        {showGuidelines ? (
          <CardBody className="space-y-6 p-5">
            {/* 6 Leave Types Grid */}
            <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
              {/* Casual Leave */}
              <div className="group flex flex-col justify-between rounded-xl border border-line bg-surface p-4 transition-all hover:border-brand-300 hover:shadow-xs">
                <div>
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-800 text-base">
                      🌴
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-ink group-hover:text-brand-800 transition-colors uppercase tracking-wide">Casual Leave</h3>
                      <p className="text-[11px] font-medium text-brand-700">Advance Request Required</p>
                    </div>
                  </div>
                  <p className="mt-2.5 text-xs text-ink-soft leading-relaxed">
                    For personal plans. Please request at least <strong className="font-semibold text-ink">2-3 days in advance</strong>.
                  </p>
                </div>
              </div>

              {/* Sick Leave */}
              <div className="group flex flex-col justify-between rounded-xl border border-line bg-surface p-4 transition-all hover:border-brand-300 hover:shadow-xs">
                <div>
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-danger-soft text-danger-ink text-base">
                      🩺
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-ink group-hover:text-brand-800 transition-colors uppercase tracking-wide">Sick Leave</h3>
                      <p className="text-[11px] font-medium text-danger">Immediate Notification</p>
                    </div>
                  </div>
                  <p className="mt-2.5 text-xs text-ink-soft leading-relaxed">
                    For medical issues. Inform <strong className="font-semibold text-ink">HR & your Team Lead ASAP</strong>.
                  </p>
                </div>
              </div>

              {/* Half Day Leave */}
              <div className="group flex flex-col justify-between rounded-xl border border-line bg-surface p-4 transition-all hover:border-brand-300 hover:shadow-xs">
                <div>
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-info-soft text-info-ink text-base">
                      🌓
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-ink group-hover:text-brand-800 transition-colors uppercase tracking-wide">Half Day Leave</h3>
                      <p className="text-[11px] font-medium text-info">Morning or Evening</p>
                    </div>
                  </div>
                  <p className="mt-2.5 text-xs text-ink-soft leading-relaxed">
                    For short personal matters (<strong className="font-semibold text-ink">Morning or Evening session</strong>).
                  </p>
                </div>
              </div>

              {/* Birthday Leave */}
              <div className="group flex flex-col justify-between rounded-xl border border-line bg-surface p-4 transition-all hover:border-brand-300 hover:shadow-xs">
                <div>
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-warn-soft text-warn-ink text-base">
                      🎂
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-ink group-hover:text-brand-800 transition-colors uppercase tracking-wide">Birthday Leave</h3>
                      <p className="text-[11px] font-medium text-warn">Special Day Perk</p>
                    </div>
                  </div>
                  <p className="mt-2.5 text-xs text-ink-soft leading-relaxed">
                    Enjoy your special day! Take a day off on your birthday to celebrate. 🎉
                  </p>
                </div>
              </div>

              {/* Lieu Leave */}
              <div className="group flex flex-col justify-between rounded-xl border border-line bg-surface p-4 transition-all hover:border-brand-300 hover:shadow-xs">
                <div>
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-success-soft text-success-ink text-base">
                      🔄
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-ink group-hover:text-brand-800 transition-colors uppercase tracking-wide">Lieu Leave</h3>
                      <p className="text-[11px] font-medium text-success">Compensatory Off</p>
                    </div>
                  </div>
                  <p className="mt-2.5 text-xs text-ink-soft leading-relaxed">
                    Compensatory time off for working on <strong className="font-semibold text-ink">weekends or public holidays</strong>.
                  </p>
                </div>
              </div>

              {/* No Pay Leave */}
              <div className="group flex flex-col justify-between rounded-xl border border-line bg-surface p-4 transition-all hover:border-brand-300 hover:shadow-xs">
                <div>
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-canvas text-ink-soft text-base">
                      🛑
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-ink group-hover:text-brand-800 transition-colors uppercase tracking-wide">No Pay Leave</h3>
                      <p className="text-[11px] font-medium text-ink-faint">Management Approval Required</p>
                    </div>
                  </div>
                  <p className="mt-2.5 text-xs text-ink-soft leading-relaxed">
                    For extended time off or when balances are exhausted. <strong className="font-semibold text-ink">Requires prior approval</strong>.
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Request Process Banner */}
            <div className="rounded-xl border border-brand-200/80 bg-brand-50/70 p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-500 text-white">
                  <SparklesIcon className="h-3 w-3" />
                </div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-brand-900">
                  Quick Request Process
                </h4>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="flex items-start gap-3 rounded-lg border border-brand-200/60 bg-white p-3 shadow-2xs">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-500 text-[11px] font-bold text-white">
                    1
                  </span>
                  <div>
                    <p className="text-xs font-bold text-ink">Request Early</p>
                    <p className="mt-0.5 text-[11.5px] text-ink-soft leading-tight">
                      Inform your Team Lead in advance (except for emergencies).
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-lg border border-brand-200/60 bg-white p-3 shadow-2xs">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-500 text-[11px] font-bold text-white">
                    2
                  </span>
                  <div>
                    <p className="text-xs font-bold text-ink">Task Handover</p>
                    <p className="mt-0.5 text-[11.5px] text-ink-soft leading-tight">
                      Hand over active tasks or blockers to a teammate before you leave.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-lg border border-brand-200/60 bg-white p-3 shadow-2xs">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-500 text-[11px] font-bold text-white">
                    3
                  </span>
                  <div>
                    <p className="text-xs font-bold text-ink">Stay Updated</p>
                    <p className="mt-0.5 text-[11.5px] text-ink-soft leading-tight">
                      Update your task statuses so the workflow continues smoothly.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardBody>
        ) : null}
      </Card>

      <Card>
        <CardHeader title="Your balances" description="Approved days are deducted; pending days are reserved." />
        <AsyncBoundary state={balances} loadingRows={2}>
          {(rows) =>
          <CardBody className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {rows.map((balance) =>
            <div key={balance.type} className="rounded-lg border border-line px-4 py-3">
                  <p className="text-[12px] font-medium uppercase tracking-wide text-ink-soft">
                    {LEAVE_TYPE_LABEL[balance.type]}
                  </p>
                  <p className="mt-1 text-2xl font-semibold tracking-tight text-ink">
                    {balance.remainingDays}
                    <span className="ml-1 text-[13px] font-normal text-ink-soft">
                      / {balance.entitlementDays} days
                    </span>
                  </p>
                  <p className="mt-1 text-[12px] text-ink-soft">
                    {balance.approvedDays} taken
                    {balance.pendingDays > 0 ? ` · ${balance.pendingDays} pending` : ''}
                  </p>
                </div>
            )}
            </CardBody>
          }
        </AsyncBoundary>
      </Card>

      {isAdmin ?
      <Card>
          <CardHeader
          title="Awaiting decision"
          description={`${pending.length} request${pending.length === 1 ? '' : 's'} from the team.`} />
        
          {requests.loading && requests.data === null ? null : pending.length === 0 ?
        <EmptyState title="Nothing pending" description="Every request from the team has been decided." /> :

        <LeaveTable
          rows={pending}
          showEmployee
          isAdmin
          currentUserId={session?.userId ?? ''}
          highlightedRequestId={targetRequestId}
          onDecide={(row, decision) => setDecisionTarget({ row, decision })}
          onCancel={handleCancel}
          cancellingId={cancellingId} />

        }
        </Card> :
      null}

      <Card>
        <CardHeader
          title={isAdmin ? 'All requests' : 'Your requests'}
          action={
          <div className="flex flex-wrap gap-1.5">
              <FilterGroup
              label="Status"
              value={status}
              options={['all', 'pending', 'approved', 'rejected', 'cancelled']}
              onChange={(value) => setStatus(value as LeaveStatus | 'all')} />
            
              <FilterGroup
              label="Type"
              value={type}
              options={['all', ...LEAVE_TYPES]}
              onChange={(value) => setType(value as LeaveType | 'all')} />
            
            </div>
          } />
        
        <AsyncBoundary
          state={requests}
          loadingRows={6}
          empty={
          <EmptyState
            title="No requests match"
            description={isAdmin ? 'Adjust the filters to see more.' : 'Request leave and it will show up here.'}
            action={
            <Button variant="secondary" size="sm" onClick={() => setRequestOpen(true)}>
                  Request leave
                </Button>
            } />

          }>
          
          {(rows) =>
          <LeaveTable
            rows={rows}
            showEmployee={isAdmin}
            isAdmin={isAdmin}
            currentUserId={session?.userId ?? ''}
            highlightedRequestId={targetRequestId}
            onDecide={(row, decision) => setDecisionTarget({ row, decision })}
            onCancel={handleCancel}
            cancellingId={cancellingId} />

          }
        </AsyncBoundary>
      </Card>

      <RequestLeaveModal
        open={requestOpen}
        onClose={() => setRequestOpen(false)}
        onSuccess={refreshAll}
        balances={balances.data} />
      
      <DecisionModal
        request={decisionTarget?.row ?? null}
        decision={decisionTarget?.decision ?? 'approved'}
        onClose={() => setDecisionTarget(null)}
        onDone={refreshAll} />

      <ManageEntitlementsModal
        open={manageEntitlementsOpen}
        onClose={() => setManageEntitlementsOpen(false)}
        onSuccess={refreshAll}
      />
    </div>);

}

function FilterGroup({
  label,
  value,
  options,
  onChange





}: {label: string;value: string;options: string[];onChange: (value: string) => void;}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[12px] text-ink-soft">{label}</span>
      <div className="flex rounded-md border border-line p-0.5">
        {options.map((option) =>
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          className={cn(
            'rounded px-2 py-1 text-[12px] font-medium capitalize transition-colors duration-150 ease-out',
            value === option ? 'bg-brand-50 text-brand-800' : 'text-ink-soft hover:text-ink'
          )}>
          
            {option}
          </button>
        )}
      </div>
    </div>);

}