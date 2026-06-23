-- ============================================================================
-- Motion Review — HYBRID schema (anonymous link-share STAYS open + optional login).
-- Run this (after the base schema.sql) when you want logged-in members to get
-- profiles + notifications, WITHOUT locking out anonymous link visitors.
--
-- vs schema-auth.sql: this does NOT touch the data tables' anon policies and
-- does NOT make the media bucket private. It only adds the auth-mode tables.
-- Pair with VITE_AUTH_OPTIONAL=true in the build.
--
-- Idempotent: safe to re-run.
-- ============================================================================

-- ---- helper: is the current user an admin? ----
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

-- ---- profiles (id = auth.users uid) ----
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  role text not null default 'member',
  data jsonb not null,
  created_at timestamptz not null default now()
);

-- ---- project membership (drives notification targeting + admin org) ----
create table if not exists public.project_members (
  project_id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);
create index if not exists project_members_user_idx on public.project_members (user_id);
create index if not exists project_members_project_idx on public.project_members (project_id);

-- ---- in-app notifications (one row per recipient) ----
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  read boolean not null default false,
  data jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx
  on public.notifications (user_id, created_at desc);

-- ============================================================================
-- RLS for the auth tables only. (Data tables keep schema.sql's anon-open RLS.)
-- ============================================================================
alter table public.profiles enable row level security;
alter table public.project_members enable row level security;
alter table public.notifications enable row level security;

drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles
  for select to authenticated using (true);
drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles
  for insert to authenticated with check (id = auth.uid());
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

drop policy if exists pm_read on public.project_members;
create policy pm_read on public.project_members
  for select to authenticated using (true);
drop policy if exists pm_write on public.project_members;
create policy pm_write on public.project_members
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists notif_read on public.notifications;
create policy notif_read on public.notifications
  for select to authenticated using (user_id = auth.uid());
drop policy if exists notif_update on public.notifications;
create policy notif_update on public.notifications
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ============================================================================
-- Realtime for the new tables
-- ============================================================================
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;
do $$
declare t text;
begin
  foreach t in array array['profiles','project_members','notifications']
  loop
    begin
      execute format('alter publication supabase_realtime add table public.%I;', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

-- ============================================================================
-- Bootstrap the first admin (same as schema-auth.sql):
--   update public.profiles
--     set role = 'admin', data = jsonb_set(data, '{role}', '"admin"')
--   where email = 'gyeomotion@vinylc.com';
-- ============================================================================
