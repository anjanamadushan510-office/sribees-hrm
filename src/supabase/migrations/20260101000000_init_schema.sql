-- 20260101000000_init_schema.sql
-- Core schema for Northwind People. Tables only; policies live in a later migration.

create extension if not exists "pgcrypto";

create type public.app_role         as enum ('admin', 'employee');
create type public.employment_status as enum ('active', 'invited', 'suspended');
create type public.work_mode        as enum ('office', 'remote', 'hybrid');
create type public.presence_status  as enum ('working', 'on_break', 'off_shift', 'on_leave');
create type public.leave_type       as enum ('annual', 'sick', 'unpaid', 'parental');
create type public.leave_status     as enum ('pending', 'approved', 'rejected', 'cancelled');
create type public.invitation_status as enum ('pending', 'accepted', 'revoked', 'expired');

-- One row per auth user. auth.users stays the source of truth for credentials.
create table public.profiles (
  id                uuid primary key references auth.users (id) on delete cascade,
  email             citext not null unique,
  full_name         text not null check (length(trim(full_name)) between 2 and 120),
  role              public.app_role not null default 'employee',
  job_title         text not null default '',
  department        text not null default '',
  manager_id        uuid references public.profiles (id) on delete set null,
  phone             text not null default '',
  location          text not null default '',
  timezone          text not null default 'UTC',
  work_mode         public.work_mode not null default 'office',
  status            public.employment_status not null default 'active',
  hire_date         date not null default current_date,
  emergency_contact text not null default '',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint profiles_manager_not_self check (manager_id is null or manager_id <> id)
);

create table public.invitations (
  id          uuid primary key default gen_random_uuid(),
  email       citext not null,
  full_name   text not null,
  role        public.app_role not null default 'employee',
  job_title   text not null,
  department  text not null,
  work_mode   public.work_mode not null default 'office',
  token_hash  text not null unique,           -- only the hash is stored, never the raw token
  status      public.invitation_status not null default 'pending',
  invited_by  uuid not null references public.profiles (id) on delete restrict,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '7 days'
);

create unique index invitations_one_pending_per_email
  on public.invitations (email)
  where status = 'pending';

create table public.attendance (
  id            uuid primary key default gen_random_uuid(),
  employee_id   uuid not null references public.profiles (id) on delete cascade,
  work_date     date not null default current_date,
  clock_in      timestamptz not null default now(),
  clock_out     timestamptz,
  break_minutes integer not null default 0 check (break_minutes between 0 and 480),
  work_mode     public.work_mode not null default 'office',
  note          text not null default '' check (length(note) <= 280),
  created_at    timestamptz not null default now(),
  constraint attendance_out_after_in check (clock_out is null or clock_out > clock_in)
);

-- At most one open shift per employee.
create unique index attendance_single_open_shift
  on public.attendance (employee_id)
  where clock_out is null;

create index attendance_employee_date_idx on public.attendance (employee_id, work_date desc);

create table public.presence (
  employee_id uuid primary key references public.profiles (id) on delete cascade,
  status      public.presence_status not null default 'off_shift',
  work_mode   public.work_mode not null default 'office',
  updated_at  timestamptz not null default now()
);

create table public.leave_entitlements (
  employee_id uuid not null references public.profiles (id) on delete cascade,
  year        integer not null check (year between 2000 and 2200),
  type        public.leave_type not null,
  days        integer not null default 0 check (days between 0 and 365),
  primary key (employee_id, year, type)
);

create table public.leave_requests (
  id            uuid primary key default gen_random_uuid(),
  employee_id   uuid not null references public.profiles (id) on delete cascade,
  type          public.leave_type not null,
  start_date    date not null,
  end_date      date not null,
  days          integer not null check (days > 0),
  reason        text not null check (length(trim(reason)) between 8 and 500),
  status        public.leave_status not null default 'pending',
  decided_by    uuid references public.profiles (id) on delete set null,
  decided_at    timestamptz,
  decision_note text not null default '' check (length(decision_note) <= 300),
  created_at    timestamptz not null default now(),
  constraint leave_end_after_start check (end_date >= start_date),
  constraint leave_no_self_approval check (decided_by is null or decided_by <> employee_id)
);

create index leave_requests_employee_idx on public.leave_requests (employee_id, created_at desc);
create index leave_requests_pending_idx on public.leave_requests (status) where status = 'pending';

create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  kind       text not null,
  title      text not null,
  body       text not null default '',
  link       text not null default '/',
  read       boolean not null default false,
  created_at timestamptz not null default now()
);

create index notifications_user_idx on public.notifications (user_id, created_at desc);

create table public.audit_logs (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references public.profiles (id) on delete set null,
  actor_email citext not null,
  action      text not null,
  entity      text not null,
  entity_id   text not null,
  meta        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index audit_logs_created_idx on public.audit_logs (created_at desc);
create index audit_logs_entity_idx on public.audit_logs (entity, created_at desc);
