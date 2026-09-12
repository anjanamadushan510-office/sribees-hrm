import React, { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { LogInIcon, LogOutIcon, MapPinIcon } from 'lucide-react';
import type { WorkMode } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { useAsync, useTicker } from '../../hooks/useAsync';
import { clockIn, clockOut, getOpenShift } from '../../utils/api/attendance';
import { formatDuration, formatTime, workedMinutes } from '../../utils/time';
import { ValidationError, toMessage } from '../../utils/policies';
import { Button } from '../ui/Button';
import { TextField, SelectField, TextAreaField } from '../ui/Field';
import { Modal } from '../ui/Modal';
import { Spinner } from '../ui/States';
import { WorkModeBadge } from '../ui/Badge';

export function ClockCard({ onChange }: {onChange?: () => void;}) {
  const { session, profile } = useAuth();
  const tick = useTicker(30000);
  const loader = useCallback(() => getOpenShift(session, session?.userId ?? ''), [session]);
  const state = useAsync(loader, [session?.userId]);

  const [workMode, setWorkMode] = useState<WorkMode>(profile?.workMode === 'hybrid' ? 'remote' : profile?.workMode ?? 'office');
  const [busy, setBusy] = useState(false);
  const [outOpen, setOutOpen] = useState(false);
  const [breakMinutes, setBreakMinutes] = useState('45');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const shift = state.data;
  const elapsed = shift ? workedMinutes(shift, new Date()) : 0;
  void tick;

  const handleClockIn = async () => {
    setBusy(true);
    try {
      await clockIn(session, workMode);
      toast.success('Clocked in. Have a good shift.');
      state.reload();
      onChange?.();
    } catch (error) {
      toast.error(toMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const handleClockOut = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      await clockOut(session, Number(breakMinutes), note);
      toast.success('Clocked out. Your hours are recorded.');
      setOutOpen(false);
      setNote('');
      state.reload();
      onChange?.();
    } catch (error) {
      if (error instanceof ValidationError) setErrors(error.fields);else
      toast.error(toMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-xl border border-line bg-surface p-5 shadow-card sm:p-6">
      {state.loading && !shift ?
      <div className="flex h-24 items-center gap-2 text-sm text-ink-soft">
          <Spinner /> Checking your shift…
        </div> :
      shift ?
      <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="flex items-center gap-2 text-[13px] font-medium text-success-ink">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
              </span>
              On the clock since {formatTime(shift.clockIn)}
            </p>
            <p className="mt-2 font-mono text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
              {formatDuration(elapsed)}
            </p>
            <p className="mt-2 flex items-center gap-2 text-[13px] text-ink-soft">
              <MapPinIcon className="h-3.5 w-3.5" />
              Working <WorkModeBadge mode={shift.workMode} />
            </p>
          </div>
          <Button variant="secondary" icon={<LogOutIcon className="h-4 w-4" />} onClick={() => setOutOpen(true)}>
            Clock out
          </Button>
        </div> :

      <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="text-[13px] font-medium text-ink-soft">You are not clocked in</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-ink">Start your day</p>
            <p className="mt-1 text-[13px] text-ink-soft">Your hours are calculated from clock-in to clock-out, minus breaks.</p>
          </div>
          <div className="flex items-end gap-2">
            <SelectField
            label="Working from"
            className="w-36"
            value={workMode}
            onChange={(event) => setWorkMode(event.target.value as WorkMode)}>
            
              <option value="office">Office</option>
              <option value="remote">Remote</option>
              <option value="hybrid">Hybrid</option>
            </SelectField>
            <Button loading={busy} icon={<LogInIcon className="h-4 w-4" />} onClick={handleClockIn}>
              Clock in
            </Button>
          </div>
        </div>
      }

      <Modal
        open={outOpen}
        onClose={() => setOutOpen(false)}
        title="Clock out"
        description="Confirm your break so today's total is accurate."
        footer={
        <>
            <Button variant="secondary" onClick={() => setOutOpen(false)}>
              Cancel
            </Button>
            <Button form="clock-out-form" type="submit" loading={busy}>
              Clock out
            </Button>
          </>
        }>
        
        <form id="clock-out-form" onSubmit={handleClockOut} className="space-y-4" noValidate>
          <div className="rounded-lg border border-line bg-canvas px-4 py-3 text-[13px] text-ink-soft">
            Shift started at <span className="font-medium text-ink">{formatTime(shift?.clockIn ?? null)}</span> ·
            elapsed <span className="font-medium text-ink">{formatDuration(elapsed + Number(breakMinutes || 0))}</span>
          </div>
          <TextField
            label="Break taken (minutes)"
            type="number"
            min={0}
            max={480}
            required
            value={breakMinutes}
            onChange={(event) => setBreakMinutes(event.target.value)}
            error={errors.breakMinutes} />
          
          <TextAreaField
            label="Note (optional)"
            placeholder="Anything HR should know about today?"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            error={errors.note} />
          
        </form>
      </Modal>
    </section>);

}