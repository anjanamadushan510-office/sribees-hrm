'use client';

import React, { useCallback, useState } from 'react';
import { ClipboardListIcon, SearchIcon } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useAsync } from '../hooks/useAsync';
import { listAuditLogs } from '../utils/api/audit';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { AsyncBoundary, EmptyState } from '../components/ui/States';
import { Badge } from '../components/ui/Badge';
import { formatDateTime } from '../utils/time';
import { cn } from '../utils/cn';

const ENTITIES = [
{ value: 'all', label: 'Everything' },
{ value: 'profile', label: 'People' },
{ value: 'invitation', label: 'Invitations' },
{ value: 'leave_request', label: 'Leave' },
{ value: 'attendance', label: 'Attendance' },
{ value: 'presence', label: 'Presence' }];


function toneFor(action: string): 'success' | 'danger' | 'warn' | 'neutral' {
  if (action.includes('approved') || action.includes('accepted') || action.includes('signed_in')) return 'success';
  if (action.includes('rejected') || action.includes('revoked') || action.includes('suspended')) return 'danger';
  if (action.includes('amended') || action.includes('role_changed') || action.includes('cancelled')) return 'warn';
  return 'neutral';
}

export function AuditLog() {
  const { session } = useAuth();
  const [entity, setEntity] = useState('all');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');

  const loader = useCallback(() => listAuditLogs(session, { entity, search: query }), [session, entity, query]);
  const state = useAsync(loader, [session?.userId, entity, query]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight text-ink">Audit log</h1>
        <p className="mt-1 text-[13px] text-ink-soft">
          Append-only record of every privileged action. Entries can be read by HR administrators and can never be
          edited or deleted.
        </p>
      </header>

      <Card>
        <CardHeader
          title="Activity"
          action={
          <form
            className="relative"
            onSubmit={(event) => {
              event.preventDefault();
              setQuery(search);
            }}>
            
              <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint" />
              <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onBlur={() => setQuery(search)}
              placeholder="Search actor or action"
              aria-label="Search the audit log"
              className="h-9 w-56 rounded-md border border-line bg-surface pl-8 pr-3 text-[13px] text-ink placeholder:text-ink-faint focus:border-brand-500" />
            
            </form>
          } />
        
        <CardBody className="flex flex-wrap gap-1.5 border-b border-line py-3">
          {ENTITIES.map((option) =>
          <button
            key={option.value}
            type="button"
            onClick={() => setEntity(option.value)}
            className={cn(
              'rounded-md border px-2.5 py-1 text-[12px] font-medium transition-colors duration-150 ease-out',
              entity === option.value ?
              'border-brand-600 bg-brand-50 text-brand-800' :
              'border-line text-ink-soft hover:bg-canvas hover:text-ink'
            )}>
            
              {option.label}
            </button>
          )}
        </CardBody>
        <AsyncBoundary
          state={state}
          loadingRows={8}
          empty={
          <EmptyState
            title="No matching activity"
            description="Try a different entity or clear the search."
            icon={<ClipboardListIcon className="h-5 w-5" />} />

          }>
          
          {(logs) =>
          <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-left text-[13px]">
                <thead>
                  <tr className="border-b border-line text-[12px] uppercase tracking-wide text-ink-soft">
                    <th scope="col" className="px-5 py-2.5 font-medium">When</th>
                    <th scope="col" className="px-5 py-2.5 font-medium">Actor</th>
                    <th scope="col" className="px-5 py-2.5 font-medium">Action</th>
                    <th scope="col" className="px-5 py-2.5 font-medium">Entity</th>
                    <th scope="col" className="px-5 py-2.5 font-medium">Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) =>
                <tr key={log.id} className="border-b border-line last:border-b-0 align-top">
                      <td className="whitespace-nowrap px-5 py-3 text-ink-soft">{formatDateTime(log.createdAt)}</td>
                      <td className="px-5 py-3 text-ink">{log.actorEmail}</td>
                      <td className="px-5 py-3">
                        <Badge tone={toneFor(log.action)}>{log.action}</Badge>
                      </td>
                      <td className="px-5 py-3 text-ink-soft">{log.entity}</td>
                      <td className="px-5 py-3 font-mono text-[12px] text-ink-soft">
                        {Object.keys(log.meta).length === 0 ?
                    '—' :
                    Object.entries(log.meta).
                    map(([key, value]) => `${key}=${value}`).
                    join('  ')}
                      </td>
                    </tr>
                )}
                </tbody>
              </table>
            </div>
          }
        </AsyncBoundary>
      </Card>
    </div>);

}