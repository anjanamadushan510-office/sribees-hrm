'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRightIcon, LockIcon } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/Button';
import { TextField } from '../components/ui/Field';
import { SessionSplash } from '../components/layout/RouteGuards';
import { DEMO_ACCOUNTS } from '../data/seed';
import { ValidationError, toMessage } from '../utils/policies';

export function Login() {
  const { status, signIn } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (status === 'authenticated') {
      router.replace('/');
    }
  }, [status, router]);

  if (status === 'loading' || status === 'authenticated') return <SessionSplash />;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setFormError(null);
    setFieldErrors({});
    try {
      await signIn(email, password);
      router.replace('/');
    } catch (error) {
      if (error instanceof ValidationError) setFieldErrors(error.fields);
      else setFormError(toMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const selectDemo = (demoEmail: string, demoPassword: string) => {
    setEmail(demoEmail);
    setPassword(demoPassword);
    setFieldErrors({});
    setFormError(null);
  };

  return (
    <div className="grid min-h-screen w-full lg:grid-cols-[1.05fr_1fr]">
      <section className="hidden flex-col justify-between bg-brand-800 px-12 py-12 text-white lg:flex">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-white text-[13px] font-bold text-brand-800">
            N
          </span>
          <span className="text-sm font-semibold">Northwind People</span>
        </div>
        <div className="max-w-md">
          <h2 className="text-3xl font-semibold leading-tight tracking-tight">
            One record of truth for attendance, leave and everyone&rsquo;s working day.
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-brand-100">
            Employees clock their own time and request leave. HR reviews, approves and reports — with every action
            written to an immutable audit trail.
          </p>
        </div>
        <p className="text-[12px] text-brand-200">
          Row-level security is enforced in the database. Signing in only ever grants you your own records.
        </p>
      </section>

      <section className="flex items-center justify-center bg-canvas px-5 py-12">
        <div className="w-full max-w-sm">
          <h1 className="text-xl font-semibold tracking-tight text-ink">Sign in</h1>
          <p className="mt-1 text-[13px] text-ink-soft">Use your Northwind work account.</p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
            <TextField
              label="Work email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              error={fieldErrors.email}
              placeholder="you@northwind.example" />
            
            <TextField
              label="Password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              error={fieldErrors.password} />
            

            {formError ?
            <p role="alert" className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-[13px] text-danger-ink">
                {formError}
              </p> :
            null}

            <Button type="submit" loading={submitting} className="w-full">
              Sign in
              {!submitting ? <ArrowRightIcon className="h-4 w-4" /> : null}
            </Button>
          </form>

          <div className="mt-8 rounded-lg border border-line bg-surface p-4">
            <p className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-ink-soft">
              <LockIcon className="h-3.5 w-3.5" /> Demo accounts
            </p>
            <ul className="mt-2.5 space-y-1.5">
              {DEMO_ACCOUNTS.map((account) =>
              <li key={account.email}>
                  <button
                  type="button"
                  onClick={() => selectDemo(account.email, account.password)}
                  className="flex w-full items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left transition-colors duration-150 ease-out hover:bg-canvas">
                  
                    <span className="min-w-0">
                      <span className="block text-[13px] font-medium text-ink">{account.label}</span>
                      <span className="block truncate text-[12px] text-ink-soft">{account.email}</span>
                    </span>
                    <span className="text-[12px] font-medium text-brand-700">Use</span>
                  </button>
                </li>
              )}
            </ul>
          </div>
        </div>
      </section>
    </div>);

}