-- Run in Supabase SQL Editor if recalls table already exists.
-- Safe to re-run: adds columns only when missing.

alter table public.recalls add column if not exists model text not null default '';
alter table public.recalls add column if not exists part_number text not null default '';
alter table public.recalls add column if not exists city text not null default '';
alter table public.recalls add column if not exists registration_date text not null default '';
alter table public.recalls add column if not exists engine_number text not null default '';
