'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { EyeIcon, EyeOffIcon, LockIcon, ArrowRightIcon, ShieldCheckIcon, CheckIcon } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/Button';
import { SessionSplash } from '../components/layout/RouteGuards';
import { DEMO_ACCOUNTS } from '../data/seed';
import { ValidationError, toMessage } from '../utils/policies';

export function Login() {
  const { status, signIn } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [selectedDemo, setSelectedDemo] = useState<string | null>(null);
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
    setSelectedDemo(demoEmail);
    setFieldErrors({});
    setFormError(null);
  };

  return (
    <div className="flex h-screen max-h-screen w-full flex-col lg:flex-row overflow-y-auto lg:overflow-hidden bg-surface">
      {/* Left Illustration Section */}
      <section className="relative flex h-full min-h-[360px] lg:min-h-0 lg:w-1/2 flex-col justify-between bg-canvas px-6 py-6 lg:px-12 lg:py-8">
        {/* Curved Wave Transition to Right Panel (Desktop only) */}
        <div className="pointer-events-none absolute inset-y-0 -right-1 hidden w-24 text-surface lg:block" aria-hidden>
          <svg className="h-full w-full fill-current" viewBox="0 0 100 100" preserveAspectRatio="none">
            <path d="M0,0 C60,25 60,75 0,100 L100,100 L100,0 Z" />
          </svg>
        </div>

        {/* Top Left Branding */}
        <div className="z-10 flex items-center gap-3">
          <img src="/logo.png" alt="Logo" className="h-8 w-auto object-contain max-w-[140px]" />
          <div>
            <h1 className="text-xl font-black uppercase tracking-wider text-brand-700 lg:text-2xl">
              HRM SOFTWARE
            </h1>
            <p className="text-xs font-medium text-brand-600 tracking-wide">
              Empowering Your Workforce
            </p>
          </div>
        </div>

        {/* Center Illustration Image */}
        <div className="z-10 my-auto flex items-center justify-center py-2">
          <div className="relative max-w-md overflow-hidden rounded-2xl border border-line/60 bg-white/40 p-2.5 shadow-lg backdrop-blur-sm">
            <img
              src="/login_illustration.jpg"
              alt="HRM Workspace Illustration"
              className="h-auto max-h-[260px] lg:max-h-[320px] w-full rounded-xl object-contain"
            />
          </div>
        </div>

        {/* Left Footer Note */}
        <div className="z-10 hidden text-[11px] font-medium text-ink-faint lg:block">
          One record of truth for attendance, leave, and employee management.
        </div>
      </section>

      {/* Right Login Form Section */}
      <section className="relative flex h-full flex-1 flex-col justify-between bg-surface px-6 py-6 lg:px-14 lg:py-8 overflow-y-auto">
        {/* Top Right Company Logo */}
        <div className="flex items-center justify-end">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="Logo" className="h-7 w-auto object-contain max-w-[130px]" />
            <span className="text-sm font-bold tracking-tight text-ink">
              HRM
            </span>
          </div>
        </div>

        {/* Center Form Container */}
        <div className="mx-auto my-auto w-full max-w-sm py-2">
          <div className="text-center lg:text-left">
            <h2 className="text-xl font-bold tracking-tight text-ink lg:text-2xl">Sign in</h2>
            <p className="mt-1 text-xs text-ink-soft">Enter your credentials to access your account</p>
          </div>

          <form onSubmit={handleSubmit} className="mt-5 space-y-4" noValidate>
            {/* Email Field */}
            <div>
              <label htmlFor="login-email" className="block text-[11px] font-semibold uppercase tracking-wider text-ink-soft">
                Email
              </label>
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                className={`mt-1 h-9 w-full rounded-lg border px-3 text-xs text-ink outline-none transition-colors duration-150 ${
                  fieldErrors.email
                    ? 'border-danger focus:border-danger'
                    : 'border-line bg-surface focus:border-brand-500 focus:ring-1 focus:ring-brand-500'
                }`}
              />
              {fieldErrors.email ? (
                <p className="mt-0.5 text-[11px] text-danger">{fieldErrors.email}</p>
              ) : null}
            </div>

            {/* Password Field with Eye Toggle */}
            <div>
              <label htmlFor="login-password" className="block text-[11px] font-semibold uppercase tracking-wider text-ink-soft">
                Password
              </label>
              <div className="relative mt-1">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className={`h-9 w-full rounded-lg border pl-3 pr-9 text-xs text-ink outline-none transition-colors duration-150 ${
                    fieldErrors.password
                      ? 'border-danger focus:border-danger'
                      : 'border-line bg-surface focus:border-brand-500 focus:ring-1 focus:ring-brand-500'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-faint transition-colors hover:text-ink"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOffIcon className="h-3.5 w-3.5" /> : <EyeIcon className="h-3.5 w-3.5" />}
                </button>
              </div>
              {fieldErrors.password ? (
                <p className="mt-0.5 text-[11px] text-danger">{fieldErrors.password}</p>
              ) : null}
            </div>

            {/* Forgot Password Link */}
            <div className="flex justify-end">
              <a
                href="#forgot"
                onClick={(e) => {
                  e.preventDefault();
                  alert('For password resets, please contact your HR administrator.');
                }}
                className="text-[11px] font-medium text-brand-700 hover:text-brand-800 hover:underline"
              >
                Forgot Your Password?
              </a>
            </div>

            {/* Form Level Error Message */}
            {formError ? (
              <p role="alert" className="rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-[11px] font-medium text-danger-ink">
                {formError}
              </p>
            ) : null}

            {/* Submit Button */}
            <Button
              type="submit"
              loading={submitting}
              className="h-9 w-full rounded-lg bg-brand-600 text-xs font-semibold text-white shadow-sm hover:bg-brand-700"
            >
              Sign in
            </Button>
          </form>

          {/* Demo Accounts Details Section */}
          <div className="mt-5 rounded-xl border border-line bg-canvas/60 p-3">
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-brand-800">
                <ShieldCheckIcon className="h-3.5 w-3.5 text-brand-600" /> Quick Demo Sign In
              </p>
              <span className="rounded bg-brand-100 px-1.5 py-0.5 text-[9px] font-semibold text-brand-800">
                1-Click Auto Fill
              </span>
            </div>
            <p className="mt-0.5 text-[11px] text-ink-soft">Click any account below to auto-fill credentials:</p>

            <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
              {DEMO_ACCOUNTS.map((account) => {
                const isSelected = selectedDemo === account.email;
                return (
                  <button
                    key={account.email}
                    type="button"
                    onClick={() => selectDemo(account.email, account.password)}
                    className={`flex flex-col justify-between rounded-lg border p-2 text-left transition-all duration-150 ${
                      isSelected
                        ? 'border-brand-500 bg-brand-50 shadow-sm ring-1 ring-brand-500'
                        : 'border-line bg-surface hover:border-brand-300 hover:bg-brand-50/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-ink">{account.label}</span>
                      {isSelected ? (
                        <CheckIcon className="h-3 w-3 text-brand-600" />
                      ) : (
                        <span className="text-[10px] font-medium text-brand-700">Use</span>
                      )}
                    </div>
                    <span className="mt-1 truncate text-[10px] font-mono text-ink-soft">
                      {account.email}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-[11px] text-ink-faint">
          © 2026 Sribees HRM (v1.0.0)
        </div>
      </section>
    </div>
  );
}