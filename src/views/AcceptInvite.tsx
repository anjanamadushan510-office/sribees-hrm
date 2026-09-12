'use client';

import React, { useCallback, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { CheckCircle2Icon } from 'lucide-react';
import { acceptInvitation, findInvitationByToken } from '../utils/api/employees';
import { useAsync } from '../hooks/useAsync';
import { Button } from '../components/ui/Button';
import { TextField } from '../components/ui/Field';
import { ErrorState, LoadingState } from '../components/ui/States';
import { ValidationError, toMessage } from '../utils/policies';
import { WORK_MODE_LABEL } from '../components/ui/Badge';

export function AcceptInvite({ token: tokenProp }: { token?: string }) {
  const params = useParams();
  const token = tokenProp || (params?.token as string) || '';
  const router = useRouter();
  const loader = useCallback(() => findInvitationByToken(token), [token]);
  const state = useAsync(loader, [token]);

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setFieldErrors({});
    setFormError(null);
    try {
      await acceptInvitation(token, password, confirm);
      setDone(true);
    } catch (error) {
      if (error instanceof ValidationError) setFieldErrors(error.fields);else
      setFormError(toMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-canvas px-5 py-12">
      <div className="w-full max-w-md rounded-xl border border-line bg-surface shadow-card">
        {state.loading ?
        <LoadingState label="Checking your invitation…" rows={4} /> :
        state.error ?
        <div className="py-4">
            <ErrorState message={state.error} />
            <div className="px-5 pb-5 text-center">
              <Link href="/login" className="text-[13px] font-medium text-brand-700 hover:underline">
                Back to sign in
              </Link>
            </div>
          </div> :
        done ?
        <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-success-soft text-success-ink">
              <CheckCircle2Icon className="h-5 w-5" />
            </span>
            <h1 className="text-base font-semibold text-ink">Your account is ready</h1>
            <p className="max-w-xs text-[13px] text-ink-soft">
              Sign in with your work email and the password you just chose.
            </p>
            <Button onClick={() => router.push('/login')}>Go to sign in</Button>
          </div> :
        state.data ?
        <div className="px-6 py-7">
            <h1 className="text-lg font-semibold tracking-tight text-ink">
              Welcome, {state.data.fullName.split(' ')[0]}
            </h1>
            <p className="mt-1 text-[13px] text-ink-soft">
              Set a password to activate your Northwind People account.
            </p>

            <dl className="mt-5 grid grid-cols-2 gap-3 rounded-lg border border-line bg-canvas px-4 py-3 text-[13px]">
              <div>
                <dt className="text-ink-soft">Role</dt>
                <dd className="font-medium text-ink">{state.data.jobTitle}</dd>
              </div>
              <div>
                <dt className="text-ink-soft">Department</dt>
                <dd className="font-medium text-ink">{state.data.department}</dd>
              </div>
              <div>
                <dt className="text-ink-soft">Work mode</dt>
                <dd className="font-medium text-ink">{WORK_MODE_LABEL[state.data.workMode]}</dd>
              </div>
              <div className="min-w-0">
                <dt className="text-ink-soft">Email</dt>
                <dd className="truncate font-medium text-ink">{state.data.email}</dd>
              </div>
            </dl>

            <form onSubmit={handleSubmit} className="mt-5 space-y-4" noValidate>
              <TextField
              label="Choose a password"
              type="password"
              autoComplete="new-password"
              required
              hint="At least 8 characters."
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              error={fieldErrors.password} />
            
              <TextField
              label="Confirm password"
              type="password"
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              error={fieldErrors.confirm} />
            
              {formError ?
            <p role="alert" className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-[13px] text-danger-ink">
                  {formError}
                </p> :
            null}
              <Button type="submit" loading={submitting} className="w-full">
                Activate account
              </Button>
            </form>
          </div> :
        null}
      </div>
    </div>);

}