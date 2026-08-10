-- Honda Recalls schema for Supabase (Postgres)
-- Run once in the Supabase SQL Editor.

create extension if not exists "pgcrypto";

-- Recalls
create table if not exists public.recalls (
  id bigserial primary key,
  reg_no text not null default '',
  vin_number text not null default '',
  reg_no_norm text not null default '',
  vin_number_norm text not null default '',
  recall_no text not null default '',
  description text not null default '',
  surname text not null default '',
  first_name text not null default '',
  telephone text not null default '',
  done integer not null default 0,
  sms_sent integer not null default 0
);

create index if not exists idx_recalls_reg on public.recalls (reg_no);
create index if not exists idx_recalls_vin on public.recalls (vin_number);
create index if not exists idx_recalls_recall_no on public.recalls (recall_no);
create index if not exists idx_recalls_reg_norm on public.recalls (reg_no_norm);
create index if not exists idx_recalls_vin_norm on public.recalls (vin_number_norm);

-- Settings (SMS template, etc.)
create table if not exists public.settings (
  key text primary key,
  value text not null default ''
);

-- Users (custom auth; not Supabase Auth)
create table if not exists public.users (
  id bigserial primary key,
  email text not null unique,
  password_hash text not null,
  first_name text not null default '',
  surname text not null default '',
  telephone text not null default '',
  city text not null default '',
  email_verified integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_users_email on public.users (email);

create table if not exists public.email_verification_tokens (
  token text primary key,
  user_id bigint not null references public.users (id) on delete cascade,
  expires_at timestamptz not null
);

-- User vehicles
create table if not exists public.user_vehicles (
  id bigserial primary key,
  user_id bigint not null references public.users (id) on delete cascade,
  reg_no text not null,
  vin_number text not null default '',
  reg_no_norm text not null default '',
  vin_number_norm text not null default '',
  vehicle_type text not null default 'Car',
  model text not null default '',
  year text not null default '',
  color text not null default '',
  created_at timestamptz not null default now(),
  unique (user_id, reg_no)
);

create index if not exists idx_user_vehicles_user on public.user_vehicles (user_id);
create index if not exists idx_user_vehicles_reg_norm on public.user_vehicles (reg_no_norm);
create index if not exists idx_user_vehicles_vin_norm on public.user_vehicles (vin_number_norm);

-- In-app notifications
create table if not exists public.notifications (
  id bigserial primary key,
  user_id bigint not null references public.users (id) on delete cascade,
  title text not null default '',
  body text not null default '',
  reg_no text not null default '',
  recall_no text not null default '',
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, reg_no, recall_no)
);

create index if not exists idx_notifications_user on public.notifications (user_id);
create index if not exists idx_notifications_unread on public.notifications (user_id, read_at);

-- Web Push subscriptions
create table if not exists public.push_subscriptions (
  id bigserial primary key,
  user_id bigint not null references public.users (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_push_subscriptions_user on public.push_subscriptions (user_id);

-- RLS: deny public roles; app uses service_role key server-side only
alter table public.recalls enable row level security;
alter table public.settings enable row level security;
alter table public.users enable row level security;
alter table public.email_verification_tokens enable row level security;
alter table public.user_vehicles enable row level security;
alter table public.notifications enable row level security;
alter table public.push_subscriptions enable row level security;

-- No policies for anon/authenticated => no access via anon key
-- service_role bypasses RLS
