import React, { useState } from 'react';
import { toast } from 'sonner';
import type { Role, WorkMode } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { inviteEmployee } from '../../utils/api/employees';
import { ValidationError, toMessage } from '../../utils/policies';
import { hasErrors, validateInvite } from '../../utils/validation';
import { Button } from '../ui/Button';
import { SelectField, TextField } from '../ui/Field';
import { Modal } from '../ui/Modal';

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: (inviteLink: string) => void;
  departments: string[];
}

const EMPTY = {
  fullName: '',
  email: '',
  jobTitle: '',
  department: '',
  role: 'employee' as Role,
  workMode: 'hybrid' as WorkMode,
  defaultPassword: 'Sribees@2026'
};

export function InviteModal({ open, onClose, onSuccess, departments }: Props) {
  const { session } = useAuth();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const set = <K extends keyof typeof EMPTY,>(key: K, value: (typeof EMPTY)[K]) =>
  setForm((current) => ({ ...current, [key]: value }));

  const close = () => {
    setForm(EMPTY);
    setErrors({});
    setFormError(null);
    onClose();
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const clientErrors = validateInvite(form);
    if (hasErrors(clientErrors)) {
      setErrors(clientErrors);
      return;
    }
    setSubmitting(true);
    setErrors({});
    setFormError(null);
    try {
      const invitation = await inviteEmployee(session, form);
      toast.success(`Account created with default password for ${invitation.email}`);
      close();
      onSuccess(`${window.location.origin}/invite/${invitation.token}`);
    } catch (error) {
      if (error instanceof ValidationError) setErrors(error.fields);else
      setFormError(toMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title="Invite an employee"
      description="Add an employee with a default password. They can sign in immediately and update their password."
      footer={
      <>
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button form="invite-form" type="submit" loading={submitting}>
            Add employee
          </Button>
        </>
      }>
      
      <form id="invite-form" onSubmit={handleSubmit} className="space-y-4" noValidate>
        <TextField
          label="Full name"
          required
          value={form.fullName}
          onChange={(event) => set('fullName', event.target.value)}
          error={errors.fullName} />
        
        <TextField
          label="Work email"
          type="email"
          required
          value={form.email}
          onChange={(event) => set('email', event.target.value)}
          error={errors.email}
          placeholder="name@sribees.com" />
        
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Job title"
            required
            value={form.jobTitle}
            onChange={(event) => set('jobTitle', event.target.value)}
            error={errors.jobTitle} />
          
          <TextField
            label="Department"
            required
            list="department-options"
            value={form.department}
            onChange={(event) => set('department', event.target.value)}
            error={errors.department} />
          
          <datalist id="department-options">
            {departments.map((department) =>
            <option key={department} value={department} />
            )}
          </datalist>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label="Access level"
            required
            value={form.role}
            onChange={(event) => set('role', event.target.value as Role)}
            error={errors.role}
            hint={form.role === 'admin' ? 'Full access to every employee record.' : 'Sees only their own records.'}>
            
            <option value="employee">Employee</option>
            <option value="admin">HR administrator</option>
          </SelectField>
          <SelectField
            label="Work mode"
            required
            value={form.workMode}
            onChange={(event) => set('workMode', event.target.value as WorkMode)}
            error={errors.workMode}>
            
            <option value="office">Office</option>
            <option value="remote">Remote</option>
            <option value="hybrid">Hybrid</option>
          </SelectField>
        </div>

        <TextField
          label="Default password"
          required
          value={form.defaultPassword}
          onChange={(event) => set('defaultPassword', event.target.value)}
          error={errors.defaultPassword}
          hint="Temporary password for initial login. The employee will change this password after logging in." />

        {formError ?
        <p role="alert" className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-[13px] text-danger-ink">
            {formError}
          </p> :
        null}
      </form>
    </Modal>);

}