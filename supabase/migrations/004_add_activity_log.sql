-- Migration 004 — activity log (calories burned, deducted from the day's net)
-- Run in Supabase → SQL Editor → New Query → Run. Safe to re-run.

create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  log_date date not null,
  activity_name text not null,
  calories_burned integer not null,
  logged_at timestamptz default now()
);

create index if not exists activity_log_user_date_idx on public.activity_log (user_id, log_date);

alter table public.activity_log enable row level security;

create policy "Users manage own activity log" on public.activity_log
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
