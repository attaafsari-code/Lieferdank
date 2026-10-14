-- Moderation of customer messages (App Review Guideline 1.2): report, block, admin review.
-- Additive and idempotent: no existing column or row is changed or removed.
begin;
alter table public.thank_yous add column if not exists sender_key text;
do $$ begin
  alter table public.thank_yous add constraint thank_yous_sender_key_check check (sender_key is null or sender_key ~ '^[0-9a-f]{64}$');
exception when duplicate_object then null; end $$;

create table if not exists public.blocked_senders (
  id          uuid primary key,
  driver_id   uuid not null references public.driver_profiles (id) on delete cascade,
  sender_key  text not null check (sender_key ~ '^[0-9a-f]{64}$'),
  created_at  timestamptz not null default now(),
  constraint blocked_senders_unique unique (driver_id, sender_key)
);

create table if not exists public.message_reports (
  id            uuid primary key,
  thank_you_id  uuid references public.thank_yous (id) on delete set null,
  driver_id     uuid not null references public.driver_profiles (id) on delete cascade,
  message       text check (message is null or char_length(message) <= 140),
  status        text not null default 'open' check (status in ('open', 'resolved')),
  created_at    timestamptz not null default now(),
  resolved_at   timestamptz,
  constraint message_reports_once unique (thank_you_id)
);
create index if not exists message_reports_open_idx on public.message_reports (status, created_at desc);

alter table public.blocked_senders enable row level security;
alter table public.message_reports enable row level security;
revoke all on public.blocked_senders, public.message_reports from anon, authenticated;
grant select, insert, update, delete on public.blocked_senders, public.message_reports to service_role;
commit;

-- Newsletter consent with double opt-in. Prepared only: sending stays off until NEWSLETTER_ENABLED=true.
begin;
create table if not exists public.marketing_consents (
  id            uuid primary key,
  user_id       uuid not null unique references public.users (id) on delete cascade,
  status        text not null check (status in ('pending', 'confirmed', 'revoked')),
  source        text not null check (source in ('web', 'app')),
  requested_at  timestamptz not null default now(),
  confirmed_at  timestamptz,
  revoked_at    timestamptz
);
alter table public.marketing_consents enable row level security;
revoke all on public.marketing_consents from anon, authenticated;
grant select, insert, update, delete on public.marketing_consents to service_role;
commit;
