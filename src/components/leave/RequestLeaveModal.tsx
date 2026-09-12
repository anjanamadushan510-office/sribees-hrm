import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { LeaveBalance, LeaveType } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { createLeaveRequest, LEAVE_TYPES, LEAVE_TYPE_LABEL } from '../../utils/api/leave';
import { businessDaysBetween, todayISO } from '../../utils/time';
import { ValidationError, toMessage } from '../../utils/policies';
import { hasErrors, validateLeave } from '../../utils/validation';
import { Button } from '../ui/Button';
import { SelectField, TextAreaField, TextField } from '../ui/Field';
import { Modal } from '../ui/Modal';

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  balances: LeaveBalance[] | null;
}

export function RequestLeaveModal({ open, onClose, onSuccess, balances }: Props) {
  const { session } = useAuth();
  const [type, setType] = useState<LeaveType>('annual');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const days = useMemo(
    () => startDate && endDate ? businessDaysBetween(startDate, endDate) : 0,
    [startDate, endDate]
  );
  const balance = balances?.find((b) => b.type === type);
  const wouldExceed = balance && type !== 'unpaid' ? days > balance.remainingDays : false;

  const reset = () => {
    setType('annual');
    setStartDate('');
    setEndDate('');
    setReason('');
    setErrors({});
    setFormError(null);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const input = { type, startDate, endDate, reason };
    const clientErrors = validateLeave(input);
    if (hasErrors(clientErrors)) {
      setErrors(clientErrors);
      return;
    }
    setSubmitting(true);
    setErrors({});
    setFormError(null);
    try {
      await createLeaveRequest(session, input);
      toast.success('Request submitted. HR has been notified.');
      reset();
      onClose();
      onSuccess();
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
      onClose={() => {
        reset();
        onClose();
      }}
      title="Request leave"
      description="Weekends are excluded automatically."
      footer={
      <>
          <Button
          variant="secondary"
          onClick={() => {
            reset();
            onClose();
          }}>
          
            Cancel
          </Button>
          <Button form="leave-form" type="submit" loading={submitting} disabled={wouldExceed}>
            Submit request
          </Button>
        </>
      }>
      
      <form id="leave-form" onSubmit={handleSubmit} className="space-y-4" noValidate>
        <SelectField
          label="Leave type"
          required
          value={type}
          onChange={(event) => setType(event.target.value as LeaveType)}
          error={errors.type}
          hint={
          balance && type !== 'unpaid' ?
          `${balance.remainingDays} of ${balance.entitlementDays} days remaining this year.` :
          'Unpaid leave does not draw from an entitlement.'
          }>
          
          {LEAVE_TYPES.map((option) =>
          <option key={option} value={option}>
              {LEAVE_TYPE_LABEL[option]}
            </option>
          )}
        </SelectField>

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="First day"
            type="date"
            required
            min={todayISO()}
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
            error={errors.startDate} />
          
          <TextField
            label="Last day"
            type="date"
            required
            min={startDate || todayISO()}
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
            error={errors.endDate} />
          
        </div>

        {days > 0 ?
        <p
          className={
          wouldExceed ?
          'rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-[13px] text-danger-ink' :
          'rounded-md border border-line bg-canvas px-3 py-2 text-[13px] text-ink-soft'
          }>
          
            {wouldExceed ?
          `That is ${days} working days but only ${balance?.remainingDays} remain.` :
          `${days} working day${days === 1 ? '' : 's'} will be deducted.`}
          </p> :
        null}

        <TextAreaField
          label="Reason"
          required
          placeholder="A sentence is enough — HR sees this when deciding."
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          error={errors.reason} />
        

        {formError ?
        <p role="alert" className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-[13px] text-danger-ink">
            {formError}
          </p> :
        null}
      </form>
    </Modal>);

}