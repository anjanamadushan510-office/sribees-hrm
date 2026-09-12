'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { CalendarPlusIcon } from 'lucide-react';
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
import { cn } from '../utils/cn';

export function Leave() {
  const { session, isAdmin } = useAuth();
  const notifications = useNotifications();
  const [requestOpen, setRequestOpen] = useState(false);
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
          <h1 className="text-xl font-semibold tracking-tight text-ink">Leave</h1>
          <p className="mt-1 text-[13px] text-ink-soft">
            {isAdmin ?
            'Review requests from the team and manage your own time off.' :
            'Request time off and track where each request stands.'}
          </p>
        </div>
        <Button icon={<CalendarPlusIcon className="h-4 w-4" />} onClick={() => setRequestOpen(true)}>
          Request leave
        </Button>
      </header>

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