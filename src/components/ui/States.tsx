import React from 'react';
import { AlertTriangleIcon, InboxIcon, Loader2Icon, ShieldAlertIcon } from 'lucide-react';
import { cn } from '../../utils/cn';
import { Button } from './Button';

export function Spinner({ className }: {className?: string;}) {
  return <Loader2Icon className={cn('h-4 w-4 animate-spin text-brand-600', className)} aria-hidden />;
}

export function LoadingState({ label = 'Loading…', rows = 3 }: {label?: string;rows?: number;}) {
  return (
    <div className="space-y-2 p-5" role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }).map((_, index) =>
      <div
        key={index}
        className="h-11 animate-pulse rounded-md bg-canvas"
        style={{ animationDelay: `${index * 60}ms` }} />

      )}
    </div>);

}

export function ErrorState({ message, onRetry }: {message: string;onRetry?: () => void;}) {
  const forbidden = /permission|suspend|administrator|only/i.test(message);
  return (
    <div className="flex flex-col items-center gap-3 px-5 py-10 text-center" role="alert">
      <span
        className={cn(
          'flex h-10 w-10 items-center justify-center rounded-full',
          forbidden ? 'bg-warn-soft text-warn-ink' : 'bg-danger-soft text-danger-ink'
        )}>
        
        {forbidden ? <ShieldAlertIcon className="h-5 w-5" /> : <AlertTriangleIcon className="h-5 w-5" />}
      </span>
      <div>
        <p className="text-sm font-semibold text-ink">{forbidden ? 'Access denied' : 'Something went wrong'}</p>
        <p className="mx-auto mt-1 max-w-sm text-[13px] text-ink-soft">{message}</p>
      </div>
      {onRetry ?
      <Button variant="secondary" size="sm" onClick={onRetry}>
          Try again
        </Button> :
      null}
    </div>);

}

export function EmptyState({
  title,
  description,
  action,
  icon





}: {title: string;description: string;action?: React.ReactNode;icon?: React.ReactNode;}) {
  return (
    <div className="flex flex-col items-center gap-3 px-5 py-12 text-center">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-canvas text-ink-soft">
        {icon ?? <InboxIcon className="h-5 w-5" />}
      </span>
      <div>
        <p className="text-sm font-semibold text-ink">{title}</p>
        <p className="mx-auto mt-1 max-w-sm text-[13px] text-ink-soft">{description}</p>
      </div>
      {action}
    </div>);

}

/**
 * Single place that decides which of loading / error / empty / content to show,
 * so no screen can silently skip a state.
 */
export function AsyncBoundary<T>({
  state,
  empty,
  children,
  loadingRows





}: {state: {data: T | null;loading: boolean;error: string | null;reload: () => void;};empty?: React.ReactNode;children: (data: T) => React.ReactNode;loadingRows?: number;}) {
  if (state.loading && state.data === null) return <LoadingState rows={loadingRows} />;
  if (state.error) return <ErrorState message={state.error} onRetry={state.reload} />;
  if (state.data === null) return <>{empty ?? null}</>;
  if (Array.isArray(state.data) && state.data.length === 0 && empty) return <>{empty}</>;
  return <>{children(state.data)}</>;
}