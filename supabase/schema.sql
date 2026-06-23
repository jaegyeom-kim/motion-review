-- ============================================================================
-- Motion Review — Supabase schema (link-share / anonymous shared workspace)
-- Paste this whole file into Supabase → SQL Editor → Run.
-- Model is stored as jsonb documents so it mirrors the app's TS objects 1:1.
-- RLS is wide open to the `anon` role on purpose: anyone with the app URL +
-- anon key shares one workspace (Frame.io-style "anyone with the link").
-- ============================================================================

-- ---- tables (id = app's nanoid string; data = the full JS object) ----
create table if not exists public.projects (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.assets (
  id text primary key,
  project_id text not null,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
create index if not exists assets_project_idx on public.assets (project_id);

create table if not exists public.branches (
  id text primary key,
  asset_id text not null,
  data jsonb not null
);
create index if not exists branches_asset_idx on public.branches (asset_id);

create table if not exists public.versions (
  id text primary key,
  asset_id text not null,
  data jsonb not null
);
create index if not exists versions_asset_idx on public.versions (asset_id);

create table if not exists public.comments (
  id text primary key,
  asset_id text not null,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
create index if not exists comments_asset_idx on public.comments (asset_id);

-- ---- Row Level Security: allow the anonymous role full access ----
do $$
declare t text;
begin
  foreach t in array array['projects','assets','branches','versions','comments']
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists anon_all on public.%I;', t);
    execute format(
      'create policy anon_all on public.%I for all to anon using (true) with check (true);', t);
    -- also let authenticated role in (harmless; future-proof)
    execute format('drop policy if exists auth_all on public.%I;', t);
    execute format(
      'create policy auth_all on public.%I for all to authenticated using (true) with check (true);', t);
  end loop;
end $$;

-- ---- Realtime: broadcast row changes for live sync ----
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;
alter publication supabase_realtime add table public.projects;
alter publication supabase_realtime add table public.assets;
alter publication supabase_realtime add table public.branches;
alter publication supabase_realtime add table public.versions;
alter publication supabase_realtime add table public.comments;

-- ---- Storage: public bucket for media (lottie json / image / video / pdf / audio) ----
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do update set public = true;

-- anyone (anon) can read + write the media bucket
drop policy if exists media_read on storage.objects;
create policy media_read on storage.objects
  for select to anon, authenticated using (bucket_id = 'media');

drop policy if exists media_write on storage.objects;
create policy media_write on storage.objects
  for insert to anon, authenticated with check (bucket_id = 'media');

drop policy if exists media_update on storage.objects;
create policy media_update on storage.objects
  for update to anon, authenticated using (bucket_id = 'media');

drop policy if exists media_delete on storage.objects;
create policy media_delete on storage.objects
  for delete to anon, authenticated using (bucket_id = 'media');
