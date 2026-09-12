import React, { useState } from 'react';
import { toast } from 'sonner';
import type { LeaveRequestRow } from '../../utils/api/leave';
import { useAuth } from '../../contexts/AuthContext';
import { decideLeaveRequest, LEAVE_TYPE_LABEL } from '../../utils/api/leave';
import { formatDate } from '../../utils/time';
import { ValidationError, toMessage } from '../../utils/policies';
import { Button } from '../ui/Button';
import { TextAreaField } from '../ui/Field';
import { Modal } from '../ui/Modal';

interface Props {
  request: LeaveRequestRow | null;
  decision: 'approved' | 'rejected';
  onClose: () => void;
  onDone: () => void;
}

export function DecisionModal({ request, decision, onClose, onDone }: Props) {
  const { session } = useAuth();
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const close = () => {
    setNote('');
    setErrors({});
    setFormError(null);
    onClose();
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!request) return;
    setSubmitting(true);
    setErrors({});
    setFormError(null);
    try {
      await decideLeaveRequest(session, request.id, decision, note);
      toast.success(decision === 'approved' ? 'Leave approved.' : 'Leave rejected.');
      close();
      onDone();
    } catch (error) {
      if (error instanceof ValidationError) setErrors(error.fields);else
      setFormError(toMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={Boolean(request)}
      onClose={close}
      title={decision === 'approved' ? 'Approve leave' : 'Reject leave'}
      description={
      request ?
      `${request.employee.fullName} · ${LEAVE_TYPE_LABEL[request.type]} · ${request.days} working day${
      request.days === 1 ? '' : 's'}` :

      ''
      }
      footer={
      <>
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button
          form="decision-form"
          type="submit"
          loading={submitting}
          variant={decision === 'approved' ? 'primary' : 'danger'}>
          
            {decision === 'approved' ? 'Approve' : 'Reject'}
          </Button>
        </>
      }>
      
      {request ?
      <form id="decision-form" onSubmit={handleSubmit} className="space-y-4" noValidate>
          <dl className="grid grid-cols-2 gap-3 rounded-lg border border-line bg-canvas px-4 py-3 text-[13px]">
            <div>
              <dt className="text-ink-soft">Dates</dt>
              <dd className="font-medium text-ink">
                {formatDate(request.startDate)} → {formatDate(request.endDate)}
              </dd>
            </div>
            <div>
              <dt className="text-ink-soft">Department</dt>
              <dd className="font-medium text-ink">{request.employee.department}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-ink-soft">Reason given</dt>
              <dd className="text-ink">{request.reason}</dd>
            </div>
          </dl>

          <TextAreaField
          label={decision === 'approved' ? 'Note (optional)' : 'Why is this rejected?'}
          required={decision === 'rejected'}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          error={errors.decisionNote}
          hint="The employee receives this with their notification." />
        

          {formError ?
        <p role="alert" className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-[13px] text-danger-ink">
              {formError}
            </p> :
        null}
        </form> :
      null}
    </Modal>);

}