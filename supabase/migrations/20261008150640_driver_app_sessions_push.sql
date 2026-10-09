begin;
create table if not exists public.mobile_sessions (
  id uuid primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  token_version integer not null default 0 check (token_version >= 0),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  push_token text check (push_token is null or length(push_token) <= 250),
  push_enabled boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists mobile_sessions_owner_idx on public.mobile_sessions(user_id);
create unique index if not exists mobile_sessions_push_token_idx on public.mobile_sessions(push_token) where push_token is not null;
create table if not exists public.push_deliveries (
  id uuid primary key,
  session_id uuid not null references public.mobile_sessions(id) on delete cascade,
  event_key text not null check (length(event_key) <= 200),
  title text not null check (length(title) <= 100),
  body text not null check (length(body) <= 300),
  screen text not null check (screen in ('earnings','thanks','stripe')),
  status text not null default 'pending' check (status in ('pending','sending','sent','delivered','failed')),
  ticket_id text,
  token_at_send text check (token_at_send is null or length(token_at_send) <= 250),
  lease_until timestamptz,
  attempts integer not null default 0 check (attempts >= 0),
  created_at timestamptz not null default now(),
  unique(session_id, event_key)
);
create index if not exists push_deliveries_queue_idx on public.push_deliveries(status, created_at);
alter table public.mobile_sessions enable row level security;
alter table public.push_deliveries enable row level security;
revoke all on public.mobile_sessions, public.push_deliveries from anon, authenticated;
grant select, insert, update, delete on public.mobile_sessions, public.push_deliveries to service_role;
commit;
