'use client';

import React, { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { CopyIcon, SearchIcon, UserPlusIcon, UsersIcon } from 'lucide-react';
import type { EmploymentStatus, WorkMode } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useAsync } from '../hooks/useAsync';
import {
  departmentsOf,
  listEmployees,
  listInvitations,
  resendInvitation,
  revokeInvitation } from
'../utils/api/employees';
import { toMessage } from '../utils/policies';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { AsyncBoundary, EmptyState } from '../components/ui/States';
import { Avatar } from '../components/ui/Avatar';
import { Badge, EmploymentBadge, WorkModeBadge } from '../components/ui/Badge';
import { InviteModal } from '../components/employees/InviteModal';
import { formatDate, relativeTime } from '../utils/time';

export function Employees() {
  const { session } = useAuth();
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('all');
  const [status, setStatus] = useState<EmploymentStatus | 'all'>('all');
  const [workMode, setWorkMode] = useState<WorkMode | 'all'>('all');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const employeesLoader = useCallback(
    () => listEmployees(session, { search, department, status, workMode }),
    [session, search, department, status, workMode]
  );
  const employees = useAsync(employeesLoader, [session?.userId, search, department, status, workMode]);

  const invitationsLoader = useCallback(() => listInvitations(session), [session]);
  const invitations = useAsync(invitationsLoader, [session?.userId]);

  const departments = useMemo(() => departmentsOf(employees.data ?? []), [employees.data]);
  const pendingInvites = (invitations.data ?? []).filter((invite) => invite.status === 'pending');

  const copyLink = async (token: string) => {
    const link = `${window.location.origin}/invite/${token}`;
    try {
      await navigator.clipboard.writeText(link);
      toast.success('Invitation link copied.');
    } catch {
      toast.message('Invitation link', { description: link });
    }
  };

  const copyCredentials = async (email: string, defaultPassword?: string) => {
    const pwd = defaultPassword || 'Sribees@2026';
    const text = `Email: ${email}\nDefault Password: ${pwd}`;
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Login credentials copied.');
    } catch {
      toast.message('Login credentials', { description: text });
    }
  };

  const handleRevoke = async (id: string) => {
    setBusyId(id);
    try {
      await revokeInvitation(session, id);
      toast.success('Invitation revoked.');
      invitations.reload();
    } catch (error) {
      toast.error(toMessage(error));
    } finally {
      setBusyId(null);
    }
  };

  const handleResend = async (id: string) => {
    setBusyId(id);
    try {
      const invite = await resendInvitation(session, id);
      toast.success('A fresh link was generated.');
      invitations.reload();
      void copyLink(invite.token);
    } catch (error) {
      toast.error(toMessage(error));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-ink">People</h1>
          <p className="mt-1 text-[13px] text-ink-soft">
            Manage employment records, access levels and invitations.
          </p>
        </div>
        <Button icon={<UserPlusIcon className="h-4 w-4" />} onClick={() => setInviteOpen(true)}>
          Invite employee
        </Button>
      </header>

      {pendingInvites.length > 0 ?
      <Card>
          <CardHeader
          title="Pending invitations"
          description={`${pendingInvites.length} person${pendingInvites.length === 1 ? '' : 's'} has not activated their account yet.`} />
        
          <ul className="divide-y divide-line">
            {pendingInvites.map((invite) =>
          <li key={invite.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <Avatar name={invite.fullName} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-ink">{invite.fullName}</p>
                  <p className="truncate text-[12px] text-ink-soft">
                    {invite.email} · {invite.jobTitle} {invite.defaultPassword ? `· Default pwd: ${invite.defaultPassword}` : ''}
                  </p>
                </div>
                <Badge tone={invite.role === 'admin' ? 'brand' : 'neutral'}>
                  {invite.role === 'admin' ? 'HR admin' : 'Employee'}
                </Badge>
                <p className="text-[12px] text-ink-soft">Expires {formatDate(invite.expiresAt)}</p>
                <div className="flex gap-1.5">
                  <Button size="sm" variant="ghost" icon={<CopyIcon className="h-3.5 w-3.5" />} onClick={() => void copyCredentials(invite.email, invite.defaultPassword)}>
                    Copy credentials
                  </Button>
                  <Button size="sm" variant="ghost" icon={<CopyIcon className="h-3.5 w-3.5" />} onClick={() => void copyLink(invite.token)}>
                    Copy link
                  </Button>
                  <Button size="sm" variant="secondary" loading={busyId === invite.id} onClick={() => void handleResend(invite.id)}>
                    Resend
                  </Button>
                  <Button size="sm" variant="ghost" loading={busyId === invite.id} onClick={() => void handleRevoke(invite.id)}>
                    Revoke
                  </Button>
                </div>
              </li>
          )}
          </ul>
        </Card> :
      null}

      <Card>
        <CardHeader
          title="Directory"
          action={
          <div className="relative">
              <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint" />
              <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, email or role"
              aria-label="Search employees"
              className="h-9 w-64 rounded-md border border-line bg-surface pl-8 pr-3 text-[13px] text-ink placeholder:text-ink-faint focus:border-brand-500" />
            
            </div>
          } />
        
        <CardBody className="flex flex-wrap gap-3 border-b border-line py-3">
          <Select label="Department" value={department} onChange={setDepartment} options={['all', ...departments]} />
          <Select
            label="Status"
            value={status}
            onChange={(value) => setStatus(value as EmploymentStatus | 'all')}
            options={['all', 'active', 'suspended']} />
          
          <Select
            label="Work mode"
            value={workMode}
            onChange={(value) => setWorkMode(value as WorkMode | 'all')}
            options={['all', 'office', 'remote', 'hybrid']} />
          
        </CardBody>

        <AsyncBoundary
          state={employees}
          loadingRows={8}
          empty={
          <EmptyState
            title="No one matches those filters"
            description="Try clearing the search or choosing a different department."
            icon={<UsersIcon className="h-5 w-5" />} />

          }>
          
          {(rows) =>
          <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] border-collapse text-left text-[13px]">
                <thead>
                  <tr className="border-b border-line text-[12px] uppercase tracking-wide text-ink-soft">
                    <th scope="col" className="px-5 py-2.5 font-medium">Employee</th>
                    <th scope="col" className="px-5 py-2.5 font-medium">Department</th>
                    <th scope="col" className="px-5 py-2.5 font-medium">Access</th>
                    <th scope="col" className="px-5 py-2.5 font-medium">Work mode</th>
                    <th scope="col" className="px-5 py-2.5 font-medium">Status</th>
                    <th scope="col" className="px-5 py-2.5 font-medium">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((employee) =>
                <tr key={employee.id} className="border-b border-line last:border-b-0 hover:bg-canvas">
                      <td className="px-5 py-3">
                        <Link href={`/employees/${employee.id}`} className="flex items-center gap-2.5 group">
                          <Avatar name={employee.fullName} size="sm" />
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-ink group-hover:underline">
                              {employee.fullName}
                            </span>
                            <span className="block truncate text-[12px] text-ink-soft">{employee.jobTitle}</span>
                          </span>
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-ink-soft">{employee.department}</td>
                      <td className="px-5 py-3">
                        <Badge tone={employee.role === 'admin' ? 'brand' : 'neutral'}>
                          {employee.role === 'admin' ? 'HR admin' : 'Employee'}
                        </Badge>
                      </td>
                      <td className="px-5 py-3">
                        <WorkModeBadge mode={employee.workMode} />
                      </td>
                      <td className="px-5 py-3">
                        <EmploymentBadge status={employee.status} />
                      </td>
                      <td className="px-5 py-3 text-ink-soft">{employee.hireDate ? formatDate(employee.hireDate) : '—'}</td>
                    </tr>
                )}
                </tbody>
              </table>
            </div>
          }
        </AsyncBoundary>
      </Card>

      <InviteModal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        departments={departments}
        onSuccess={(link) => {
          invitations.reload();
          toast.message('Invitation link', { description: link });
        }} />
      
    </div>);

}

function Select({
  label,
  value,
  options,
  onChange





}: {label: string;value: string;options: string[];onChange: (value: string) => void;}) {
  return (
    <label className="flex items-center gap-2 text-[12px] text-ink-soft">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-8 rounded-md border border-line bg-surface px-2 text-[13px] capitalize text-ink focus:border-brand-500">
        
        {options.map((option) =>
        <option key={option} value={option} className="capitalize">
            {option}
          </option>
        )}
      </select>
    </label>);

}