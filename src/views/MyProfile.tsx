'use client';

import React, { useState } from 'react';
import { toast } from 'sonner';
import { LockIcon, ShieldAlertIcon } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { updateEmployeeProfile } from '../utils/api/employees';
import { changePassword } from '../utils/api/auth';
import { ValidationError, toMessage } from '../utils/policies';
import { hasErrors, validateProfile } from '../utils/validation';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { TextField, SelectField } from '../components/ui/Field';
import { Avatar } from '../components/ui/Avatar';
import { Badge, EmploymentBadge, WorkModeBadge } from '../components/ui/Badge';
import { formatDate } from '../utils/time';
import type { WorkMode } from '../types';

export function MyProfile() {
  const { session, profile, isAdmin, refreshProfile } = useAuth();
  const [form, setForm] = useState({
    phone: profile?.phone ?? '',
    location: profile?.location ?? '',
    timezone: profile?.timezone ?? '',
    emergencyContact: profile?.emergencyContact ?? '',
    workMode: (profile?.workMode ?? 'office') as WorkMode
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  if (!profile) return null;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const clientErrors = validateProfile(form);
    if (hasErrors(clientErrors)) {
      setErrors(clientErrors);
      return;
    }
    setSaving(true);
    setErrors({});
    try {
      await updateEmployeeProfile(session, profile.id, form);
      await refreshProfile();
      toast.success('Your details were saved.');
    } catch (error) {
      if (error instanceof ValidationError) setErrors(error.fields);else
      toast.error(toMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {profile.mustChangePassword ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warn/30 bg-warn-soft p-4 text-[13px] text-warn-ink shadow-sm">
          <div className="flex items-center gap-3">
            <ShieldAlertIcon className="h-5 w-5 shrink-0 text-warn" />
            <div>
              <p className="font-semibold">Security Update Required</p>
              <p className="text-[12px] opacity-90">
                You are currently logged in with a default password set by HR. Please change your password below.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <header className="flex flex-wrap items-center gap-4 rounded-xl border border-line bg-surface p-5 shadow-card sm:p-6">
        <Avatar name={profile.fullName} size="lg" />
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold tracking-tight text-ink">{profile.fullName}</h1>
          <p className="mt-0.5 text-[13px] text-ink-soft">
            {profile.jobTitle} · {profile.department}
          </p>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            <EmploymentBadge status={profile.status} />
            <WorkModeBadge mode={profile.workMode} />
            <Badge tone={isAdmin ? 'brand' : 'neutral'}>{isAdmin ? 'HR administrator' : 'Employee'}</Badge>
          </div>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Your details" description="These are the fields you can change yourself." />
            <CardBody>
              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                <div className="grid gap-4 sm:grid-cols-2">
                  <SelectField
                    label="Work mode"
                    value={form.workMode}
                    onChange={(event) => setForm({ ...form, workMode: event.target.value as WorkMode })}
                    hint="Your default location mode (Office, Remote, or Hybrid)">
                    <option value="office">Office</option>
                    <option value="remote">Remote</option>
                    <option value="hybrid">Hybrid</option>
                  </SelectField>

                  <TextField
                    label="Phone"
                    value={form.phone}
                    onChange={(event) => setForm({ ...form, phone: event.target.value })}
                    error={errors.phone}
                    placeholder="+1 555 000 0000" />
                  
                  <TextField
                    label="Location"
                    value={form.location}
                    onChange={(event) => setForm({ ...form, location: event.target.value })}
                    error={errors.location}
                    placeholder="City, Country" />
                  
                  <TextField
                    label="Timezone"
                    required
                    value={form.timezone}
                    onChange={(event) => setForm({ ...form, timezone: event.target.value })}
                    error={errors.timezone}
                    hint="Used to show your local working hours to teammates." />
                  
                  <TextField
                    label="Emergency contact"
                    value={form.emergencyContact}
                    onChange={(event) => setForm({ ...form, emergencyContact: event.target.value })}
                    error={errors.emergencyContact}
                    placeholder="Name · phone number" />
                  
                </div>
                <div className="flex justify-end">
                  <Button type="submit" loading={saving}>
                    Save details
                  </Button>
                </div>
              </form>
            </CardBody>
          </Card>

          <ChangePasswordCard />
        </div>

        <Card className="h-fit">
          <CardHeader
            title="Managed by People Operations"
            description="Ask HR if any of these need to change — they are not editable by employees." />
          
          <CardBody>
            <dl className="grid gap-4 text-[13px] sm:grid-cols-2">
              <div>
                <dt className="text-ink-soft">Work email</dt>
                <dd className="mt-0.5 font-medium text-ink">{profile.email}</dd>
              </div>
              <div>
                <dt className="text-ink-soft">Job title</dt>
                <dd className="mt-0.5 font-medium text-ink">{profile.jobTitle}</dd>
              </div>
              <div>
                <dt className="text-ink-soft">Department</dt>
                <dd className="mt-0.5 font-medium text-ink">{profile.department}</dd>
              </div>
              <div>
                <dt className="text-ink-soft">Start date</dt>
                <dd className="mt-0.5 font-medium text-ink">{formatDate(profile.hireDate)}</dd>
              </div>
            </dl>
            <p className="mt-4 flex items-start gap-2 rounded-md border border-line bg-canvas px-3 py-2.5 text-[12px] text-ink-soft">
              <LockIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Access level, employment status and leave entitlements are protected by row-level security. Attempts to
              change them from this account are rejected by the database, not just hidden in the interface.
            </p>
          </CardBody>
        </Card>
      </div>
    </div>);

}

function ChangePasswordCard() {
  const { session, refreshProfile } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setErrors({});
    try {
      await changePassword(session, currentPassword, newPassword, confirmPassword);
      await refreshProfile();
      toast.success('Your password was changed successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      if (error instanceof ValidationError) setErrors(error.fields);
      else toast.error(toMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div id="change-password">
      <Card>
        <CardHeader
          title="Security & Password"
          description="Change your password to secure your account."
        />
      <CardBody>
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <TextField
            label="Current password"
            type="password"
            required
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            error={errors.currentPassword}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="New password"
              type="password"
              required
              hint="At least 8 characters."
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              error={errors.newPassword}
            />
            <TextField
              label="Confirm new password"
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              error={errors.confirmPassword}
            />
          </div>
          <div className="flex justify-end">
            <Button type="submit" loading={saving}>
              Change password
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
    </div>
  );
}