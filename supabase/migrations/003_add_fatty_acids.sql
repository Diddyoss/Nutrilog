-- Migration 003 — fatty acids (Omega-3/6, mono/polyunsaturated)
-- Run in Supabase → SQL Editor → New Query → Run. Safe to re-run.

alter table public.food_log add column if not exists omega_3_g numeric default 0;
alter table public.food_log add column if not exists omega_6_g numeric default 0;
alter table public.food_log add column if not exists monounsaturated_fat_g numeric default 0;
alter table public.food_log add column if not exists polyunsaturated_fat_g numeric default 0;

-- Fish-oil style supplements contribute omega-3/6 too.
alter table public.supplement_log add column if not exists omega_3_g numeric default 0;
alter table public.supplement_log add column if not exists omega_6_g numeric default 0;
alter table public.supplement_log add column if not exists monounsaturated_fat_g numeric default 0;
alter table public.supplement_log add column if not exists polyunsaturated_fat_g numeric default 0;
