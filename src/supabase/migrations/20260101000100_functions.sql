-- 20260101000100_functions.sql
-- Helper functions, derived-balance view and privileged RPCs.
-- Anything marked SECURITY DEFINER runs with a locked search_path.

-- Reads the caller's role WITHOUT re-entering the profiles RLS policy.
create or replace function public.current_role()
returns public.app_role
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and status = 'active'
  );
$$;

create or replace function public.is_active()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and status = 'active'
  );
$$;

-- Inclusive Mon–Fri day count, used to compute leave length server-side.
create or replace function public.business_days(start_date date, end_date date)
returns integer
language sql
immutable
as $$
  select count(*)::int
  from generate_series(start_date, end_date, interval '1 day') as d
  where extract(isodow from d) < 6;
$$;

create or replace function public.worked_minutes(a public.attendance)
returns integer
language sql
stable
as $$
  select greatest(
    0,
    (extract(epoch from (coalesce(a.clock_out, now()) - a.clock_in)) / 60)::int - a.break_minutes
  );
$$;

-- Balances are DERIVED, never stored, so they cannot drift from the requests.
create or replace view public.leave_balances
with (security_invoker = true) as
select
  e.employee_id,
  e.year,
  e.type,
  e.days as entitlement_days,
  coalesce(sum(r.days) filter (where r.status = 'approved'), 0)::int as approved_days,
  coalesce(sum(r.days) filter (where r.status = 'pending'), 0)::int  as pending_days,
  (e.days
    - coalesce(sum(r.days) filter (where r.status = 'approved'), 0)
    - coalesce(sum(r.days) filter (where r.status = 'pending'), 0))::int as remaining_days
from public.leave_entitlements e
left join public.leave_requests r
  on r.employee_id = e.employee_id
 and r.type = e.type
 and extract(year from r.start_date) = e.year
group by e.employee_id, e.year, e.type, e.days;

-- Server-side length + overlap + balance enforcement for leave.
create or replace function public.enforce_leave_rules()
returns trigger
language plpgsql
as $$
declare
  remaining integer;
begin
  new.days := public.business_days(new.start_date, new.end_date);
  if new.days = 0 then
    raise exception 'Leave must cover at least one working day';
  end if;

  if exists (
    select 1 from public.leave_requests r
    where r.employee_id = new.employee_id
      and r.id is distinct from new.id
      and r.status in ('pending', 'approved')
      and daterange(r.start_date, r.end_date, '[]') && daterange(new.start_date, new.end_date, '[]')
  ) then
    raise exception 'These dates overlap an existing request';
  end if;

  if new.type <> 'unpaid' and new.status in ('pending', 'approved') then
    select remaining_days into remaining
    from public.leave_balances
    where employee_id = new.employee_id
      and year = extract(year from new.start_date)
      and type = new.type;

    if remaining is not null and new.days > remaining then
      raise exception 'Requested days exceed the remaining entitlement';
    end if;
  end if;

  return new;
end;
$$;

create trigger leave_requests_enforce
before insert on public.leave_requests
for each row execute function public.enforce_leave_rules();

-- Employees may never change their own privileged columns, even with a direct
-- PostgREST call: the trigger restores the previous values.
create or replace function public.protect_privileged_profile_columns()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then
    new.role      := old.role;
    new.status    := old.status;
    new.job_title := old.job_title;
    new.department := old.department;
    new.work_mode := old.work_mode;
    new.manager_id := old.manager_id;
    new.email     := old.email;
    new.hire_date := old.hire_date;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_protect_columns
before update on public.profiles
for each row execute function public.protect_privileged_profile_columns();

-- The organisation must always keep at least one active administrator.
create or replace function public.ensure_admin_remains()
returns trigger
language plpgsql
as $$
begin
  if (old.role = 'admin' and (new.role <> 'admin' or new.status <> 'active'))
     and not exists (
       select 1 from public.profiles
       where id <> old.id and role = 'admin' and status = 'active'
     )
  then
    raise exception 'At least one active administrator is required';
  end if;
  return new;
end;
$$;

create trigger profiles_keep_one_admin
before update on public.profiles
for each row execute function public.ensure_admin_remains();

-- Accepting an invitation is the only unauthenticated write in the system.
-- The raw token is never stored, the role comes from the invitation row, and the
-- function is rate-limited by the single-use token hash.
create or replace function public.accept_invitation(raw_token text, new_user_id uuid)
returns public.profiles
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  inv public.invitations;
  created public.profiles;
  yr integer := extract(year from current_date);
begin
  select * into inv
  from public.invitations
  where token_hash = encode(digest(raw_token, 'sha256'), 'hex')
    and status = 'pending'
    and expires_at > now()
  for update;

  if inv.id is null then
    raise exception 'Invitation is invalid or expired';
  end if;

  insert into public.profiles (id, email, full_name, role, job_title, department, work_mode, manager_id, status)
  values (new_user_id, inv.email, inv.full_name, inv.role, inv.job_title, inv.department, inv.work_mode, inv.invited_by, 'active')
  returning * into created;

  insert into public.presence (employee_id, work_mode) values (created.id, created.work_mode);

  insert into public.leave_entitlements (employee_id, year, type, days)
  values (created.id, yr, 'annual', 25),
         (created.id, yr, 'sick', 10),
         (created.id, yr, 'parental', 20),
         (created.id, yr, 'unpaid', 15);

  update public.invitations set status = 'accepted' where id = inv.id;

  insert into public.audit_logs (actor_id, actor_email, action, entity, entity_id, meta)
  values (created.id, created.email, 'invitation.accepted', 'invitation', inv.id::text,
          jsonb_build_object('email', created.email));

  return created;
end;
$$;

revoke all on function public.accept_invitation(text, uuid) from public;
grant execute on function public.accept_invitation(text, uuid) to anon, authenticated;
