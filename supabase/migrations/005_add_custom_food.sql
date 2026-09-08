-- Migration 005 — saved custom foods ("My Foods")
-- Manually entered foods are saved here so they can be re-logged with one tap.
-- Run in Supabase → SQL Editor → New Query → Run. Safe to re-run.

create table if not exists public.custom_food (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  food_name text not null,
  serving_size text,
  calories integer not null,
  protein_g numeric default 0,
  carbs_g numeric default 0,
  fat_g numeric default 0,
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
  saturated_fat_g numeric default 0,
  unsaturated_fat_g numeric default 0,
  trans_fat_g numeric default 0,
  fiber_g numeric default 0,
  omega_3_g numeric default 0,
  omega_6_g numeric default 0,
  monounsaturated_fat_g numeric default 0,
  polyunsaturated_fat_g numeric default 0,
  use_count integer not null default 1,
  last_used_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, food_name)
);

create index if not exists custom_food_user_last_used_idx
  on public.custom_food (user_id, last_used_at desc);

alter table public.custom_food enable row level security;

drop policy if exists "Users manage own custom foods" on public.custom_food;
create policy "Users manage own custom foods" on public.custom_food
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
