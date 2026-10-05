-- The Daily Digest: optional reader accounts.
-- Run once in the Supabase dashboard: SQL Editor → New query → paste this file → Run.
-- Row Level Security (RLS) limits every row to the signed-in reader who owns it; signed-out
-- requests (the public publishable key alone) can read and write nothing.

create table if not exists public.saved_stories (
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  story_id   text        not null,
  story      jsonb       not null check (pg_column_size(story) < 4096),
  saved_at   timestamptz not null default now(),
  primary key (user_id, story_id)
);

create table if not exists public.preferences (
  user_id    uuid        primary key default auth.uid() references auth.users (id) on delete cascade,
  sections   text[]      not null default '{}',
  firms      text[]      not null default '{}',
  updated_at timestamptz not null default now()
);

alter table public.saved_stories enable row level security;
alter table public.preferences   enable row level security;

drop policy if exists "Readers manage their own saved stories" on public.saved_stories;
create policy "Readers manage their own saved stories" on public.saved_stories
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Readers manage their own preferences" on public.preferences;
create policy "Readers manage their own preferences" on public.preferences
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
