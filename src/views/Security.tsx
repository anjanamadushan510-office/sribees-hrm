'use client';

import React, { useState } from 'react';
import { CheckIcon, PlayIcon, ShieldAlertIcon, ShieldCheckIcon, XIcon } from 'lucide-react';
import type { CheckResult } from '../utils/api/securityChecks';
import { runSecurityChecks } from '../utils/api/securityChecks';
import { useAuth } from '../contexts/AuthContext';
import { toMessage } from '../utils/policies';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { EmptyState, ErrorState, LoadingState } from '../components/ui/States';
import { cn } from '../utils/cn';

export function Security() {
  const { session } = useAuth();
  const [results, setResults] = useState<CheckResult[] | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setRunning(true);
    setError(null);
    try {
      setResults(await runSecurityChecks(session));
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setRunning(false);
    }
  };

  const passed = results?.filter((r) => r.passed).length ?? 0;
  const failed = results ? results.length - passed : 0;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-ink">Security checks</h1>
          <p className="mt-1 max-w-2xl text-[13px] text-ink-soft">
            Runs the critical authorization scenarios against the live policy layer. Every scenario attempts an action
            that must be refused, so running them never changes any data.
          </p>
        </div>
        <Button loading={running} icon={<PlayIcon className="h-4 w-4" />} onClick={run}>
          Run all checks
        </Button>
      </header>

      {results && results.length > 0 ?
      <div
        className={cn(
          'flex items-center gap-3 rounded-xl border px-5 py-4',
          failed === 0 ? 'border-success/25 bg-success-soft' : 'border-danger/25 bg-danger-soft'
        )}>
        
          <span
          className={cn(
            'flex h-9 w-9 items-center justify-center rounded-full',
            failed === 0 ? 'bg-success text-white' : 'bg-danger text-white'
          )}>
          
            {failed === 0 ? <ShieldCheckIcon className="h-4 w-4" /> : <ShieldAlertIcon className="h-4 w-4" />}
          </span>
          <div>
            <p className={cn('text-sm font-semibold', failed === 0 ? 'text-success-ink' : 'text-danger-ink')}>
              {failed === 0 ? `All ${passed} scenarios blocked as expected` : `${failed} scenario(s) were not blocked`}
            </p>
            <p className="mt-0.5 text-[13px] text-ink-soft">
              {failed === 0 ?
            'Unauthorized access is prevented at the service layer, independently of the interface.' :
            'Do not treat this build as production-ready until every scenario passes.'}
            </p>
          </div>
        </div> :
      null}

      <Card>
        <CardHeader title="Scenarios" description="Privilege escalation, cross-user reads, self-approval and server-side validation." />
        {running && !results ?
        <LoadingState label="Running security scenarios…" rows={6} /> :
        error ?
        <ErrorState message={error} onRetry={run} /> :
        !results ?
        <EmptyState
          title="No results yet"
          description="Run the checks to verify that unauthorized access is refused."
          action={
          <Button variant="secondary" size="sm" onClick={run}>
                Run all checks
              </Button>
          }
          icon={<ShieldCheckIcon className="h-5 w-5" />} /> :


        <ul className="divide-y divide-line">
            {results.map((result) =>
          <li key={result.id} className="flex gap-3 px-5 py-3.5">
                <span
              className={cn(
                'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full',
                result.passed ? 'bg-success-soft text-success-ink' : 'bg-danger-soft text-danger-ink'
              )}
              aria-hidden>
              
                  {result.passed ? <CheckIcon className="h-3 w-3" /> : <XIcon className="h-3 w-3" />}
                </span>
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-ink">{result.scenario}</p>
                  <p className="mt-0.5 text-[12px] text-ink-soft">Expected: {result.expectation}</p>
                  <p
                className={cn(
                  'mt-1 font-mono text-[12px]',
                  result.passed ? 'text-ink-faint' : 'font-semibold text-danger-ink'
                )}>
                
                    {result.detail}
                  </p>
                  <span className="sr-only">{result.passed ? 'Passed' : 'Failed'}</span>
                </div>
              </li>
          )}
          </ul>
        }
        <CardBody className="border-t border-line text-[12px] text-ink-soft">
          These scenarios mirror the RLS policy tests in <span className="font-mono">supabase/migrations</span>. The
          same rules are enforced in Postgres, so they hold even for requests that never touch this interface.
        </CardBody>
      </Card>
    </div>);

}