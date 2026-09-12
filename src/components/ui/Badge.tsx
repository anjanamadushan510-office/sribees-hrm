import React from 'react';
import { cn } from '../../utils/cn';
import type { EmploymentStatus, LeaveStatus, Presence, WorkMode } from '../../types';

type Tone = 'neutral' | 'success' | 'warn' | 'danger' | 'info' | 'brand';

const TONES: Record<Tone, string> = {
  neutral: 'bg-canvas text-ink-soft border-line',
  success: 'bg-success-soft text-success-ink border-transparent',
  warn: 'bg-warn-soft text-warn-ink border-transparent',
  danger: 'bg-danger-soft text-danger-ink border-transparent',
  info: 'bg-info-soft text-info-ink border-transparent',
  brand: 'bg-brand-50 text-brand-800 border-transparent'
};

export function Badge({ tone = 'neutral', children }: {tone?: Tone;children: React.ReactNode;}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[12px] font-medium leading-5',
        TONES[tone]
      )}>
      
      {children}
    </span>);

}

const EMPLOYMENT: Record<EmploymentStatus, {tone: Tone;label: string;}> = {
  active: { tone: 'success', label: 'Active' },
  invited: { tone: 'info', label: 'Invited' },
  suspended: { tone: 'danger', label: 'Suspended' }
};

export function EmploymentBadge({ status }: {status: EmploymentStatus;}) {
  return <Badge tone={EMPLOYMENT[status].tone}>{EMPLOYMENT[status].label}</Badge>;
}

const LEAVE: Record<LeaveStatus, {tone: Tone;label: string;}> = {
  pending: { tone: 'warn', label: 'Pending' },
  approved: { tone: 'success', label: 'Approved' },
  rejected: { tone: 'danger', label: 'Rejected' },
  cancelled: { tone: 'neutral', label: 'Cancelled' }
};

export function LeaveBadge({ status }: {status: LeaveStatus;}) {
  return <Badge tone={LEAVE[status].tone}>{LEAVE[status].label}</Badge>;
}

const PRESENCE: Record<Presence['status'], {dot: string;label: string;}> = {
  working: { dot: 'bg-success', label: 'Working' },
  on_break: { dot: 'bg-warn', label: 'On break' },
  off_shift: { dot: 'bg-ink-faint', label: 'Off shift' },
  on_leave: { dot: 'bg-info', label: 'On leave' }
};

export function PresenceDot({ status, withLabel = true }: {status: Presence['status'];withLabel?: boolean;}) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] text-ink-soft">
      <span className={cn('h-2 w-2 shrink-0 rounded-full', PRESENCE[status].dot)} aria-hidden />
      {withLabel ? PRESENCE[status].label : <span className="sr-only">{PRESENCE[status].label}</span>}
    </span>);

}

const WORK_MODE_LABEL: Record<WorkMode, string> = {
  office: 'Office',
  remote: 'Remote',
  hybrid: 'Hybrid'
};

export function WorkModeBadge({ mode }: {mode: WorkMode;}) {
  return <Badge tone={mode === 'remote' ? 'brand' : mode === 'hybrid' ? 'info' : 'neutral'}>{WORK_MODE_LABEL[mode]}</Badge>;
}

export { WORK_MODE_LABEL };