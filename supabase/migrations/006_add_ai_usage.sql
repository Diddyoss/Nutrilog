-- Migration 006 — AI photo analysis usage log
-- One row per photo analysed; /api/analyze-food counts a user's rows in the
-- last 24h to enforce a daily limit (AI_DAILY_LIMIT, default 30).
-- Run in Supabase → SQL Editor → New Query → Run. Safe to re-run.

create table if not exists public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null default 'photo',
  created_at timestamptz not null default now()
);

create index if not exists ai_usage_user_created_idx on public.ai_usage (user_id, created_at);

alter table public.ai_usage enable row level security;

-- Read and insert only. With no update/delete policy a user cannot erase
-- their own usage to get around the limit.
drop policy if exists "Users read own AI usage" on public.ai_usage;
create policy "Users read own AI usage" on public.ai_usage
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users record own AI usage" on public.ai_usage;
create policy "Users record own AI usage" on public.ai_usage
  for insert to authenticated
  with check (auth.uid() = user_id);
