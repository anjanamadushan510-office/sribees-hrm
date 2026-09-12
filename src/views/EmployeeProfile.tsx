'use client';

import React, { useCallback, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeftIcon, ShieldCheckIcon } from 'lucide-react';
import type { Role, WorkMode } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useAsync } from '../hooks/useAsync';
import { getEmployee, setEmployeeStatus, updateEmployment } from '../utils/api/employees';
import { getLeaveBalances, setEntitlement, LEAVE_TYPE_LABEL } from '../utils/api/leave';
import { listAttendance } from '../utils/api/attendance';
import { summarizeAttendance } from '../utils/api/stats';
import { ValidationError, toMessage } from '../utils/policies';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { SelectField, TextField } from '../components/ui/Field';
import { AsyncBoundary, ErrorState, LoadingState } from '../components/ui/States';
import { Avatar } from '../components/ui/Avatar';
import { Badge, EmploymentBadge, WorkModeBadge } from '../components/ui/Badge';
import { StatTile } from '../components/dashboard/StatTile';
import { formatDate, formatDuration, toISODate } from '../utils/time';

export function EmployeeProfile({ id: idProp }: { id?: string }) {
  const params = useParams();
  const id = idProp || (params?.id as string) || '';
  const { session, profile: me } = useAuth();

  const employeeLoader = useCallback(() => getEmployee(session, id), [session, id]);
  const employee = useAsync(employeeLoader, [session?.userId, id]);

  const balancesLoader = useCallback(() => getLeaveBalances(session, id), [session, id]);
  const balances = useAsync(balancesLoader, [session?.userId, id]);

  const since = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return toISODate(d);
  })();
  const attendanceLoader = useCallback(
    () => listAttendance(session, { employeeId: id, from: since }),
    [session, id, since]
  );
  const attendance = useAsync(attendanceLoader, [session?.userId, id]);

  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState<{jobTitle: string;department: string;workMode: WorkMode;role: Role;} | null>(null);

  if (employee.loading && !employee.data) return <LoadingState rows={6} />;
  if (employee.error) return <ErrorState message={employee.error} onRetry={employee.reload} />;
  if (!employee.data) return null;

  const person = employee.data;
  const current = form ?? {
    jobTitle: person.jobTitle,
    department: person.department,
    workMode: person.workMode,
    role: person.role
  };
  const isSelf = person.id === me?.id;
  const summary = summarizeAttendance(attendance.data ?? []);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setErrors({});
    try {
      await updateEmployment(session, person.id, { ...current, managerId: person.managerId });
      toast.success('Employment details updated.');
      setForm(null);
      employee.reload();
    } catch (error) {
      if (error instanceof ValidationError) setErrors(error.fields);else
      toast.error(toMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async () => {
    setSaving(true);
    try {
      await setEmployeeStatus(session, person.id, person.status === 'active' ? 'suspended' : 'active');
      toast.success(person.status === 'active' ? 'Access suspended.' : 'Access restored.');
      employee.reload();
    } catch (error) {
      toast.error(toMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const changeEntitlement = async (type: Parameters<typeof setEntitlement>[2], days: number) => {
    try {
      await setEntitlement(session, person.id, type, days);
      toast.success('Entitlement updated.');
      balances.reload();
    } catch (error) {
      toast.error(toMessage(error));
    }
  };

  return (
    <div className="space-y-6">
      <Link
        href="/employees"
        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-soft transition-colors duration-150 ease-out hover:text-ink">
        
        <ArrowLeftIcon className="h-3.5 w-3.5" /> All people
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-line bg-surface p-5 shadow-card sm:p-6">
        <div className="flex items-start gap-4">
          <Avatar name={person.fullName} size="lg" />
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-ink">{person.fullName}</h1>
            <p className="mt-0.5 text-[13px] text-ink-soft">
              {person.jobTitle} · {person.department}
            </p>
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              <EmploymentBadge status={person.status} />
              <WorkModeBadge mode={person.workMode} />
              <Badge tone={person.role === 'admin' ? 'brand' : 'neutral'}>
                {person.role === 'admin' ? 'HR administrator' : 'Employee'}
              </Badge>
            </div>
          </div>
        </div>
        <Button variant={person.status === 'active' ? 'danger' : 'primary'} loading={saving} disabled={isSelf} onClick={toggleStatus}>
          {person.status === 'active' ? 'Suspend access' : 'Restore access'}
        </Button>
      </header>

      {isSelf ?
      <p className="flex items-start gap-2 rounded-lg border border-info/20 bg-info-soft px-4 py-2.5 text-[13px] text-info-ink">
          <ShieldCheckIcon className="mt-0.5 h-4 w-4 shrink-0" />
          You are viewing your own record. Administrators cannot suspend or demote themselves — another HR
          administrator must do it.
        </p> :
      null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Employment" description="Changing access level takes effect immediately." />
            <CardBody>
              <form onSubmit={save} className="space-y-4" noValidate>
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField
                    label="Job title"
                    required
                    value={current.jobTitle}
                    onChange={(event) => setForm({ ...current, jobTitle: event.target.value })}
                    error={errors.jobTitle} />
                  
                  <TextField
                    label="Department"
                    required
                    value={current.department}
                    onChange={(event) => setForm({ ...current, department: event.target.value })}
                    error={errors.department} />
                  
                  <SelectField
                    label="Work mode"
                    value={current.workMode}
                    onChange={(event) => setForm({ ...current, workMode: event.target.value as WorkMode })}
                    error={errors.workMode}>
                    
                    <option value="office">Office</option>
                    <option value="remote">Remote</option>
                    <option value="hybrid">Hybrid</option>
                  </SelectField>
                  <SelectField
                    label="Access level"
                    value={current.role}
                    disabled={isSelf}
                    onChange={(event) => setForm({ ...current, role: event.target.value as Role })}
                    error={errors.role}
                    hint={isSelf ? 'You cannot change your own access level.' : undefined}>
                    
                    <option value="employee">Employee</option>
                    <option value="admin">HR administrator</option>
                  </SelectField>
                </div>
                <div className="flex justify-end gap-2">
                  {form ?
                  <Button variant="secondary" type="button" onClick={() => setForm(null)}>
                      Discard
                    </Button> :
                  null}
                  <Button type="submit" loading={saving} disabled={!form}>
                    Save changes
                  </Button>
                </div>
              </form>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Contact" description="Employees maintain these details themselves." />
            <CardBody>
              <dl className="grid gap-4 text-[13px] sm:grid-cols-2">
                <Detail label="Work email" value={person.email} />
                <Detail label="Phone" value={person.phone || 'Not provided'} />
                <Detail label="Location" value={person.location || 'Not provided'} />
                <Detail label="Timezone" value={person.timezone} />
                <Detail label="Emergency contact" value={person.emergencyContact || 'Not provided'} />
                <Detail label="Joined" value={person.hireDate ? formatDate(person.hireDate) : '—'} />
              </dl>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Last 30 days" />
            <CardBody className="grid gap-3">
              <StatTile label="Hours logged" value={formatDuration(summary.minutes)} hint={`${summary.days} days recorded`} />
              <StatTile label="Average day" value={formatDuration(summary.avg)} hint="Excluding breaks" />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Leave entitlements" description="Balances are derived from approved requests." />
            <AsyncBoundary state={balances} loadingRows={3}>
              {(rows) =>
              <CardBody className="space-y-3">
                  {rows.map((balance) =>
                <div key={balance.type} className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-ink">{LEAVE_TYPE_LABEL[balance.type]}</p>
                        <p className="text-[12px] text-ink-soft">
                          {balance.approvedDays} taken · {balance.pendingDays} pending · {balance.remainingDays} left
                        </p>
                      </div>
                      <input
                    type="number"
                    min={0}
                    max={365}
                    defaultValue={balance.entitlementDays}
                    aria-label={`${LEAVE_TYPE_LABEL[balance.type]} entitlement in days`}
                    onBlur={(event) => {
                      const next = Number(event.target.value);
                      if (next !== balance.entitlementDays) void changeEntitlement(balance.type, next);
                    }}
                    className="h-9 w-20 rounded-md border border-line bg-surface px-2 text-right text-[13px] text-ink focus:border-brand-500" />
                  
                    </div>
                )}
                </CardBody>
              }
            </AsyncBoundary>
          </Card>
        </div>
      </div>
    </div>);

}

function Detail({ label, value }: {label: string;value: string;}) {
  return (
    <div>
      <dt className="text-ink-soft">{label}</dt>
      <dd className="mt-0.5 font-medium text-ink">{value}</dd>
    </div>);

}