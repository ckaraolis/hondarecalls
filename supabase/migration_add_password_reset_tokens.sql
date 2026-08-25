-- Password reset tokens for customer accounts
create table if not exists public.password_reset_tokens (
  token text primary key,
  user_id bigint not null references public.users (id) on delete cascade,
  expires_at timestamptz not null
);

alter table public.password_reset_tokens enable row level security;
