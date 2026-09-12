-- 20260101000200_rls_policies.sql
-- Row-level security. Deny by default: RLS is enabled on every table and no
-- table grants anything to the `anon` role except the accept_invitation RPC.
-- Each policy name matches a guard in utils/policies.ts.

alter table public.profiles           enable row level security;
alter table public.invitations        enable row level security;
alter table public.attendance         enable row level security;
alter table public.presence           enable row level security;
alter table public.leave_entitlements enable row level security;
alter table public.leave_requests     enable row level security;
alter table public.notifications      enable row level security;
alter table public.audit_logs         enable row level security;

alter table public.profiles           force row level security;
alter table public.invitations        force row level security;
alter table public.attendance         force row level security;
alter table public.leave_requests     force row level security;
alter table public.audit_logs         force row level security;

------------------------------------------------------------------- profiles --
-- Directory reads are allowed for active staff; sensitive columns are served
-- through the public.directory view below rather than the base table.
create policy profiles_select_self on public.profiles
  for select to authenticated
  using (id = auth.uid());

create policy profiles_select_admin on public.profiles
  for select to authenticated
  using (public.is_admin());

create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = auth.uid() and public.is_active())
  with check (id = auth.uid());
  -- Privileged columns are additionally reverted by profiles_protect_columns.

create policy profiles_update_admin on public.profiles
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Profiles are only created by accept_invitation (SECURITY DEFINER); there is
-- deliberately no INSERT or DELETE policy for clients.

create or replace view public.directory
with (security_invoker = true) as
select id, full_name, email, job_title, department, work_mode, status, timezone, location, manager_id
from public.profiles
where status = 'active';

grant select on public.directory to authenticated;

---------------------------------------------------------------- invitations --
create policy invitations_admin_all on public.invitations
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

------------------------------------------------------------------ attendance --
create policy attendance_select_own on public.attendance
  for select to authenticated
  using (employee_id = auth.uid());

create policy attendance_select_admin on public.attendance
  for select to authenticated
  using (public.is_admin());

create policy attendance_insert_own on public.attendance
  for insert to authenticated
  with check (
    employee_id = auth.uid()
    and public.is_active()
    and clock_out is null
    and not exists (
      select 1 from public.leave_requests r
      where r.employee_id = auth.uid()
        and r.status = 'approved'
        and current_date between r.start_date and r.end_date
    )
  );

-- An employee may only close their own OPEN shift. Historical rows are immutable
-- for them; corrections are an HR action and always land in the audit log.
create policy attendance_update_own_open on public.attendance
  for update to authenticated
  using (employee_id = auth.uid() and clock_out is null)
  with check (employee_id = auth.uid());

create policy attendance_update_admin on public.attendance
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-------------------------------------------------------------------- presence --
create policy presence_select_authenticated on public.presence
  for select to authenticated
  using (public.is_active());

create policy presence_upsert_own on public.presence
  for insert to authenticated
  with check (employee_id = auth.uid());

create policy presence_update_own on public.presence
  for update to authenticated
  using (employee_id = auth.uid())
  with check (employee_id = auth.uid());

create policy presence_update_admin on public.presence
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

--------------------------------------------------------- leave entitlements --
create policy entitlements_select_own on public.leave_entitlements
  for select to authenticated
  using (employee_id = auth.uid());

create policy entitlements_admin_all on public.leave_entitlements
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

------------------------------------------------------------- leave requests --
create policy leave_select_own on public.leave_requests
  for select to authenticated
  using (employee_id = auth.uid());

create policy leave_select_admin on public.leave_requests
  for select to authenticated
  using (public.is_admin());

create policy leave_insert_own on public.leave_requests
  for insert to authenticated
  with check (
    employee_id = auth.uid()
    and public.is_active()
    and status = 'pending'
    and decided_by is null
    and start_date >= current_date
  );

-- Employees can only cancel their own request, and only while it has not started.
create policy leave_cancel_own on public.leave_requests
  for update to authenticated
  using (employee_id = auth.uid() and status in ('pending', 'approved') and start_date > current_date)
  with check (employee_id = auth.uid() and status = 'cancelled');

-- HR decides on anyone's request except their own (also enforced by the
-- leave_no_self_approval table constraint).
create policy leave_decide_admin on public.leave_requests
  for update to authenticated
  using (public.is_admin() and employee_id <> auth.uid())
  with check (public.is_admin() and decided_by = auth.uid());

----------------------------------------------------------------- notifications --
create policy notifications_select_own on public.notifications
  for select to authenticated
  using (user_id = auth.uid());

create policy notifications_update_own on public.notifications
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Notifications are only ever created by triggers / SECURITY DEFINER functions,
-- so clients get no INSERT policy at all.

-------------------------------------------------------------------- audit log --
create policy audit_select_admin on public.audit_logs
  for select to authenticated
  using (public.is_admin());

create policy audit_insert_authenticated on public.audit_logs
  for insert to authenticated
  with check (actor_id = auth.uid());

-- Append-only: no UPDATE or DELETE policy exists on public.audit_logs.

--------------------------------------------------------------------- grants --
revoke all on all tables in schema public from anon;
revoke all on all functions in schema public from anon;
grant execute on function public.accept_invitation(text, uuid) to anon;
