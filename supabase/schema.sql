-- NutriLog schema — run this in the Supabase SQL editor.
-- Requires: Authentication → Sign In / Up → "Allow anonymous sign-ins" enabled.

create extension if not exists pgcrypto;

-- User profile (one row per user)
create table if not exists public.user_profile (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text,
  sex text check (sex in ('male', 'female')),
  age integer,
  height_cm numeric,
  weight_kg numeric,
  goal text check (goal in ('cutting', 'maintenance', 'bulking')),
  activity_level text check (activity_level in ('sedentary', 'light', 'moderate', 'very', 'athlete')),
  calorie_target integer,
  protein_target_g integer,
  carbs_target_g integer,
  fat_target_g integer,
  calorie_override integer,
  units text default 'metric' check (units in ('metric', 'imperial')),
  wake_time text default '07:00',
  sleep_time text default '23:00',
  created_at timestamptz default now(),
  unique (user_id)
);

-- Daily food log
create table if not exists public.food_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  log_date date not null,
  meal text check (meal in ('breakfast', 'lunch', 'dinner', 'snacks')),
  food_name text not null,
  serving_size text,
  calories integer not null,
  protein_g numeric,
  carbs_g numeric,
  fat_g numeric,
  source text check (source in ('scan', 'ai_photo', 'search', 'manual')),
  logged_at timestamptz default now()
);

create index if not exists food_log_user_date_idx on public.food_log (user_id, log_date);

-- Weight log
create table if not exists public.weight_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  log_date date not null,
  weight_kg numeric not null,
  logged_at timestamptz default now()
);

create index if not exists weight_log_user_date_idx on public.weight_log (user_id, log_date);

-- Row Level Security: each user can only read/write their own rows.
alter table public.user_profile enable row level security;
alter table public.food_log enable row level security;
alter table public.weight_log enable row level security;

create policy "Users manage own profile" on public.user_profile
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage own food log" on public.food_log
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage own weight log" on public.weight_log
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
