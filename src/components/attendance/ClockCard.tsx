import React, { useCallback, useState } from "react";
import { toast } from "sonner";
import {
  CoffeeIcon,
  LogInIcon,
  LogOutIcon,
  MapPinIcon,
  PlayIcon,
} from "lucide-react";
import type { WorkMode } from "../../types";
import { useAuth } from "../../contexts/AuthContext";
import { useAsync, useTicker } from "../../hooks/useAsync";
import {
  clockIn,
  clockOut,
  getOpenShift,
  setPresence,
} from "../../utils/api/attendance";
import {
  formatDuration,
  formatDurationWithSeconds,
  formatTime,
  workedMinutes,
  workedSeconds,
} from "../../utils/time";
import { ValidationError, toMessage } from "../../utils/policies";
import { Button } from "../ui/Button";
import { TextField, TextAreaField } from "../ui/Field";
import { Modal } from "../ui/Modal";
import { Spinner } from "../ui/States";
import { WorkModeBadge } from "../ui/Badge";

export function ClockCard({ onChange }: { onChange?: () => void }) {
  const { session, profile } = useAuth();
  // Tick every 1000ms (1 second) for live seconds counter
  const tick = useTicker(1000);
  const loader = useCallback(
    () => getOpenShift(session, session?.userId ?? ""),
    [session],
  );
  const state = useAsync(loader, [session?.userId]);

  const [busy, setBusy] = useState(false);
  const [onBreak, setOnBreak] = useState(false);
  const [breakStartTimestamp, setBreakStartTimestamp] = useState<number | null>(
    null,
  );
  const [outOpen, setOutOpen] = useState(false);
  const [breakMinutes, setBreakMinutes] = useState("0");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const shift = state.data;
  const elapsedSecs = shift ? workedSeconds(shift, new Date()) : 0;
  const elapsedMins = shift ? workedMinutes(shift, new Date()) : 0;
  void tick;

  const handleClockIn = async () => {
    setBusy(true);
    try {
      await clockIn(session, profile?.workMode ?? "office");
      toast.success("Clocked in. Have a good shift.");
      state.reload();
      onChange?.();
    } catch (error) {
      toast.error(toMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const handleToggleBreak = async () => {
    setBusy(true);
    try {
      if (!onBreak) {
        // Start Break
        await setPresence(session, "on_break");
        setOnBreak(true);
        setBreakStartTimestamp(Date.now());
        toast.success("Break started. Take your time.");
      } else {
        // End Break / Resume Work
        await setPresence(session, "working");
        if (breakStartTimestamp) {
          const addedMins = Math.max(
            1,
            Math.round((Date.now() - breakStartTimestamp) / 60000),
          );
          setBreakMinutes((prev) => String(Number(prev) + addedMins));
        }
        setOnBreak(false);
        setBreakStartTimestamp(null);
        toast.success("Break ended. Welcome back to work!");
      }
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
      toast.success("Clocked out. Your hours are recorded.");
      setOutOpen(false);
      setNote("");
      setOnBreak(false);
      setBreakStartTimestamp(null);
      state.reload();
      onChange?.();
    } catch (error) {
      if (error instanceof ValidationError) setErrors(error.fields);
      else toast.error(toMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-xl border border-line bg-surface p-5 shadow-card sm:p-6">
      {state.loading && !shift ? (
        <div className="flex h-24 items-center gap-2 text-sm text-ink-soft">
          <Spinner /> Checking your shift…
        </div>
      ) : shift ? (
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="flex items-center gap-2 text-[13px] font-medium text-success-ink">
              {onBreak ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-warn/20 px-2.5 py-0.5 text-xs font-semibold text-warn-ink">
                  <CoffeeIcon className="h-3.5 w-3.5" /> On Break
                </span>
              ) : (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
                  </span>
                  On the clock since {formatTime(shift.clockIn)}
                </>
              )}
            </p>
            {/* Live Ticking Counter with Seconds */}
            <p className="mt-2 font-mono text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
              {formatDurationWithSeconds(elapsedSecs)}
            </p>
            <p className="mt-2 flex items-center gap-2 text-[13px] text-ink-soft">
              <MapPinIcon className="h-3.5 w-3.5 text-brand-600" />
              Working <WorkModeBadge mode={shift.workMode} />
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Start Break / Resume Work Button */}
            <Button
              variant={onBreak ? "primary" : "secondary"}
              loading={busy}
              icon={
                onBreak ? (
                  <PlayIcon className="h-4 w-4" />
                ) : (
                  <CoffeeIcon className="h-4 w-4" />
                )
              }
              onClick={handleToggleBreak}
            >
              {onBreak ? "Resume work" : "Start break"}
            </Button>

            {/* Clock Out Button */}
            <Button
              variant="secondary"
              icon={<LogOutIcon className="h-4 w-4" />}
              onClick={() => setOutOpen(true)}
            >
              Clock out
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="text-[13px] font-medium text-ink-soft">
              You are not clocked in
            </p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-ink">
              Start your day
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-[13px] text-ink-soft">
              Your hours are calculated from clock-in to clock-out, minus
              breaks. · <WorkModeBadge mode={profile?.workMode ?? "office"} />
            </p>
          </div>
          <div className="flex items-end gap-2">
            <Button
              loading={busy}
              icon={<LogInIcon className="h-4 w-4" />}
              onClick={handleClockIn}
            >
              Clock in
            </Button>
          </div>
        </div>
      )}

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
        }
      >
        <form
          id="clock-out-form"
          onSubmit={handleClockOut}
          className="space-y-4"
          noValidate
        >
          <div className="rounded-lg border border-line bg-canvas px-4 py-3 text-[13px] text-ink-soft">
            Shift started at{" "}
            <span className="font-medium text-ink">
              {formatTime(shift?.clockIn ?? null)}
            </span>{" "}
            · elapsed{" "}
            <span className="font-medium text-ink">
              {formatDuration(elapsedMins)}
            </span>
          </div>
          <TextField
            label="Break taken (minutes)"
            type="number"
            min={0}
            max={480}
            required
            value={breakMinutes}
            onChange={(event) => setBreakMinutes(event.target.value)}
            error={errors.breakMinutes}
          />

          <TextAreaField
            label="Note (optional)"
            placeholder="Anything HR should know about today?"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            error={errors.note}
          />
        </form>
      </Modal>
    </section>
  );
}
