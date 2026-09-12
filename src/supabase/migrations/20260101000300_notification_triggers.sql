-- 20260101000300_notification_triggers.sql
-- Notification fan-out and audit trails happen in the database, so they cannot
-- be skipped by a client that talks to PostgREST directly.

create or replace function public.notify_admins(kind text, title text, body text, link text)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  insert into public.notifications (user_id, kind, title, body, link)
  select id, kind, title, body, link
  from public.profiles
  where role = 'admin' and status = 'active';
$$;

create or replace function public.on_leave_request_inserted()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  who text;
begin
  select full_name into who from public.profiles where id = new.employee_id;

  perform public.notify_admins(
    'leave_submitted',
    who || ' requested ' || new.type || ' leave',
    new.days || ' working day(s) awaiting your decision.',
    '/leave'
  );

  insert into public.audit_logs (actor_id, actor_email, action, entity, entity_id, meta)
  select new.employee_id, p.email, 'leave.submitted', 'leave_request', new.id::text,
         jsonb_build_object('type', new.type, 'days', new.days)
  from public.profiles p where p.id = new.employee_id;

  return new;
end;
$$;

create trigger leave_requests_after_insert
after insert on public.leave_requests
for each row execute function public.on_leave_request_inserted();

create or replace function public.on_leave_request_decided()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status is distinct from old.status and new.status in ('approved', 'rejected', 'cancelled') then
    insert into public.notifications (user_id, kind, title, body, link)
    values (
      new.employee_id,
      'leave_decided',
      'Your ' || new.type || ' leave was ' || new.status,
      coalesce(nullif(new.decision_note, ''), new.days || ' working day(s) from ' || new.start_date),
      '/leave'
    );

    insert into public.audit_logs (actor_id, actor_email, action, entity, entity_id, meta)
    select auth.uid(), coalesce(p.email, 'system'), 'leave.' || new.status, 'leave_request', new.id::text,
           jsonb_build_object('employee_id', new.employee_id, 'days', new.days)
    from public.profiles p where p.id = auth.uid();

    if new.status = 'approved' and current_date between new.start_date and new.end_date then
      update public.presence set status = 'on_leave', updated_at = now()
      where employee_id = new.employee_id;
    end if;
  end if;
  return new;
end;
$$;

create trigger leave_requests_after_decision
after update on public.leave_requests
for each row execute function public.on_leave_request_decided();

create or replace function public.on_profile_privileged_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.role is distinct from old.role or new.status is distinct from old.status then
    insert into public.audit_logs (actor_id, actor_email, action, entity, entity_id, meta)
    select auth.uid(), coalesce(p.email, 'system'),
           case when new.role is distinct from old.role then 'employee.role_changed'
                else 'employee.status_changed' end,
           'profile', new.id::text,
           jsonb_build_object('role', new.role, 'status', new.status)
    from public.profiles p where p.id = auth.uid();

    insert into public.notifications (user_id, kind, title, body, link)
    values (new.id, 'invitation_accepted', 'Your account was updated',
            'Access level: ' || new.role || ' · status: ' || new.status, '/profile');
  end if;
  return new;
end;
$$;

create trigger profiles_after_privileged_change
after update on public.profiles
for each row execute function public.on_profile_privileged_change();

create or replace function public.on_attendance_closed()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.clock_out is null and new.clock_out is not null then
    insert into public.audit_logs (actor_id, actor_email, action, entity, entity_id, meta)
    select auth.uid(), coalesce(p.email, 'system'), 'attendance.clock_out', 'attendance', new.id::text,
           jsonb_build_object('minutes', public.worked_minutes(new), 'break_minutes', new.break_minutes)
    from public.profiles p where p.id = auth.uid();

    update public.presence set status = 'off_shift', updated_at = now()
    where employee_id = new.employee_id;
  end if;
  return new;
end;
$$;

create trigger attendance_after_close
after update on public.attendance
for each row execute function public.on_attendance_closed();
