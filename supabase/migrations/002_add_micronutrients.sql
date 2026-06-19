-- Migration 002 — micronutrient tracking
-- Run in Supabase → SQL Editor → New Query → Run. Safe to re-run.

-- 1) Add micronutrient columns to the existing food_log table.
alter table public.food_log add column if not exists vitamin_a_mcg numeric default 0;
alter table public.food_log add column if not exists vitamin_c_mg numeric default 0;
alter table public.food_log add column if not exists vitamin_d_mcg numeric default 0;
alter table public.food_log add column if not exists vitamin_e_mg numeric default 0;
alter table public.food_log add column if not exists vitamin_k_mcg numeric default 0;
alter table public.food_log add column if not exists vitamin_b6_mg numeric default 0;
alter table public.food_log add column if not exists vitamin_b12_mcg numeric default 0;
alter table public.food_log add column if not exists folate_mcg numeric default 0;
alter table public.food_log add column if not exists calcium_mg numeric default 0;
alter table public.food_log add column if not exists iron_mg numeric default 0;
alter table public.food_log add column if not exists magnesium_mg numeric default 0;
alter table public.food_log add column if not exists potassium_mg numeric default 0;
alter table public.food_log add column if not exists zinc_mg numeric default 0;
alter table public.food_log add column if not exists sodium_mg numeric default 0;
alter table public.food_log add column if not exists saturated_fat_g numeric default 0;
alter table public.food_log add column if not exists unsaturated_fat_g numeric default 0;
alter table public.food_log add column if not exists trans_fat_g numeric default 0;
alter table public.food_log add column if not exists fiber_g numeric default 0;

-- 2) Supplement log (vitamins/minerals that count toward the same daily totals).
--    NOTE: includes user_id (the original spec omitted it, which the RLS policy below requires).
create table if not exists public.supplement_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  log_date date not null,
  supplement_name text not null,
  dose text,
  vitamin_a_mcg numeric default 0,
  vitamin_c_mg numeric default 0,
  vitamin_d_mcg numeric default 0,
  vitamin_e_mg numeric default 0,
  vitamin_k_mcg numeric default 0,
  vitamin_b6_mg numeric default 0,
  vitamin_b12_mcg numeric default 0,
  folate_mcg numeric default 0,
  calcium_mg numeric default 0,
  iron_mg numeric default 0,
  magnesium_mg numeric default 0,
  potassium_mg numeric default 0,
  zinc_mg numeric default 0,
  sodium_mg numeric default 0,
  logged_at timestamptz default now()
);

create index if not exists supplement_log_user_date_idx on public.supplement_log (user_id, log_date);

alter table public.supplement_log enable row level security;

create policy "Users manage own supplement entries" on public.supplement_log
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
