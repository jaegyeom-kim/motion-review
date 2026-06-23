-- ============================================================================
-- Motion Review — AUTH CUTOVER schema.
-- Run this in Supabase → SQL Editor → Run *only when ready to require login*.
-- It (1) adds profiles / project_members / notifications, (2) locks every
-- table to the `authenticated` role (removes anonymous access), and (3) makes
-- the media bucket private. Pair it with VITE_REQUIRE_AUTH=true in the build.
--
-- Idempotent: safe to re-run.
-- ============================================================================

-- ---- helper: is the current user an admin? (SECURITY DEFINER avoids RLS
--      recursion when used inside the profiles policies) ----
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
-- RLS
-- ============================================================================
alter table public.profiles enable row level security;
alter table public.project_members enable row level security;
alter table public.notifications enable row level security;

-- profiles: everyone signed-in can read; you can write your own row; admins
-- can write anyone's (role changes).
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

-- project_members: signed-in read; only admins mutate.
drop policy if exists pm_read on public.project_members;
create policy pm_read on public.project_members
  for select to authenticated using (true);
drop policy if exists pm_write on public.project_members;
create policy pm_write on public.project_members
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- notifications: you only see + update your own. INSERTs come from the
-- service-role Edge Function (bypasses RLS), so there's no insert policy.
drop policy if exists notif_read on public.notifications;
create policy notif_read on public.notifications
  for select to authenticated using (user_id = auth.uid());
drop policy if exists notif_update on public.notifications;
create policy notif_update on public.notifications
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---- lock the data tables to authenticated only (remove anonymous access) ----
do $$
declare t text;
begin
  foreach t in array array['projects','assets','branches','versions','comments']
  loop
    execute format('alter table public.%I enable row level security;', t);
    -- drop the wide-open anonymous policy from the link-share schema
    execute format('drop policy if exists anon_all on public.%I;', t);
    -- (re)create authenticated full access
    execute format('drop policy if exists auth_all on public.%I;', t);
    execute format(
      'create policy auth_all on public.%I for all to authenticated using (true) with check (true);', t);
  end loop;
end $$;

-- ============================================================================
-- Realtime
-- ============================================================================
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;
-- add the new tables (ignore "already member" errors)
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
-- Storage: make the media bucket private + authenticated-only
-- ============================================================================
update storage.buckets set public = false where id = 'media';

drop policy if exists media_read on storage.objects;
create policy media_read on storage.objects
  for select to authenticated using (bucket_id = 'media');

drop policy if exists media_write on storage.objects;
create policy media_write on storage.objects
  for insert to authenticated with check (bucket_id = 'media');

drop policy if exists media_update on storage.objects;
create policy media_update on storage.objects
  for update to authenticated using (bucket_id = 'media');

drop policy if exists media_delete on storage.objects;
create policy media_delete on storage.objects
  for delete to authenticated using (bucket_id = 'media');

-- ============================================================================
-- Bootstrap the first admin.
-- 1) Create the account: Supabase dashboard → Authentication → Users → Add user
--    (email = your address), OR have them log in once so a profile row exists.
-- 2) Promote to admin (keeps the jsonb `data.role` in sync with the column):
--
--   update public.profiles
--     set role = 'admin',
--         data = jsonb_set(data, '{role}', '"admin"')
--   where email = 'gyeomotion@vinylc.com';
-- ============================================================================
