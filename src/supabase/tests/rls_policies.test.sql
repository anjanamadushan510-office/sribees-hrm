-- supabase/tests/rls_policies.test.sql
-- pgTAP suite for the critical security scenarios.
-- Run with: supabase test db
-- Mirrors utils/api/securityChecks.ts, which runs the same scenarios in-app.

begin;
select plan(11);

-- Fixtures ------------------------------------------------------------------
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'hr@test.example'),
  ('00000000-0000-0000-0000-0000000000e1', 'emp1@test.example'),
  ('00000000-0000-0000-0000-0000000000e2', 'emp2@test.example'),
  ('00000000-0000-0000-0000-0000000000s1', 'susp@test.example')
on conflict do nothing;

insert into public.profiles (id, email, full_name, role, status, job_title, department) values
  ('00000000-0000-0000-0000-0000000000a1', 'hr@test.example',   'HR Admin',  'admin',    'active',    'Head of People', 'People'),
  ('00000000-0000-0000-0000-0000000000e1', 'emp1@test.example', 'Employee 1','employee', 'active',    'Engineer', 'Engineering'),
  ('00000000-0000-0000-0000-0000000000e2', 'emp2@test.example', 'Employee 2','employee', 'active',    'Designer', 'Design'),
  ('00000000-0000-0000-0000-0000000000s1', 'susp@test.example', 'Suspended', 'employee', 'suspended', 'QA', 'Engineering');

insert into public.leave_entitlements (employee_id, year, type, days)
values ('00000000-0000-0000-0000-0000000000e1', extract(year from current_date)::int, 'annual', 5);

insert into public.attendance (employee_id, clock_in, clock_out)
values ('00000000-0000-0000-0000-0000000000e2', now() - interval '3 hours', now() - interval '1 hour');

insert into public.notifications (user_id, kind, title)
values ('00000000-0000-0000-0000-0000000000e2', 'leave_decided', 'Private to emp2');

-- Act as employee 1 ----------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000e1","role":"authenticated"}';

select is(
  (select count(*) from public.attendance where employee_id = '00000000-0000-0000-0000-0000000000e2')::int,
  0, 'Employee cannot read a colleague''s attendance');

select is(
  (select count(*) from public.notifications where user_id = '00000000-0000-0000-0000-0000000000e2')::int,
  0, 'Employee cannot read a colleague''s notifications');

select is(
  (select count(*) from public.audit_logs)::int,
  0, 'Employee cannot read the audit log');

select is(
  (select count(*) from public.invitations)::int,
  0, 'Employee cannot read invitations');

-- Privilege escalation: the claimed JWT role is irrelevant, is_admin() reads the row.
select ok(not public.is_admin(), 'is_admin() is false for an employee regardless of JWT claims');

update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000000e1';
select is(
  (select role::text from public.profiles where id = '00000000-0000-0000-0000-0000000000e1'),
  'employee', 'Self-promotion is reverted by protect_privileged_profile_columns()');

select throws_ok(
  $$insert into public.leave_requests (employee_id, type, start_date, end_date, days, reason)
    values ('00000000-0000-0000-0000-0000000000e1', 'annual', current_date + 1, current_date + 40, 1,
            'Attempting to exceed the entitlement')$$,
  null, null, 'Requesting more days than remain is rejected');

select throws_ok(
  $$insert into public.leave_requests (employee_id, type, start_date, end_date, days, reason)
    values ('00000000-0000-0000-0000-0000000000e2', 'annual', current_date + 1, current_date + 2, 1,
            'Filing leave on behalf of somebody else')$$,
  null, null, 'Cannot create a leave request for another employee');

select throws_ok(
  $$insert into public.audit_logs (actor_id, actor_email, action, entity, entity_id)
    values ('00000000-0000-0000-0000-0000000000a1', 'hr@test.example', 'forged', 'profile', 'x')$$,
  null, null, 'Cannot forge an audit entry attributed to somebody else');

-- Act as the suspended employee ---------------------------------------------
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000s1","role":"authenticated"}';
select ok(not public.is_active(), 'Suspended accounts are not active');

select throws_ok(
  $$insert into public.attendance (employee_id) values ('00000000-0000-0000-0000-0000000000s1')$$,
  null, null, 'Suspended employee cannot clock in');

select * from finish();
rollback;
