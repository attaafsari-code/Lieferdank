-- ---------------------------------------------------------------------------
-- Lieferdank – Datenbankschema (Supabase / Postgres)
--
-- Anwenden: Supabase Studio → SQL Editor → dieses Skript ausführen.
-- Danach in .env.local setzen:
--   LIEFERDANK_DB=supabase
--   SUPABASE_URL=...
--   SUPABASE_SERVICE_ROLE_KEY=...
--
-- Der Zugriff läuft ausschließlich serverseitig über den Service-Role-Key.
-- Row Level Security ist trotzdem aktiv und verweigert per Default alles,
-- damit ein versehentlich veröffentlichter anon-Key keinen Zugriff gibt (§92).
-- ---------------------------------------------------------------------------

create table if not exists public.users (
  id uuid primary key,
  name text not null,
  email text not null unique,
  phone text,
  role text not null default 'driver' check (role in ('driver', 'admin')),
  password_hash text not null,
  created_at timestamptz not null default now(),
  blocked_at timestamptz,
  blocked_reason text,
  -- Wird bei jedem Passwortwechsel erhöht und macht alte Sessions ungültig.
  token_version integer not null default 0
);

create table if not exists public.password_resets (
  id uuid primary key,
  user_id uuid not null references public.users (id) on delete cascade,
  -- Nur der SHA-256-Hash des Tokens, nie das Token selbst.
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.driver_profiles (
  id uuid primary key,
  user_id uuid not null unique references public.users (id) on delete cascade,
  display_name text not null,
  code text not null unique,
  provider_id text,
  provider_verified boolean not null default false,
  verification text not null default 'unverified'
    check (verification in ('unverified', 'pending', 'verified', 'rejected')),
  active boolean not null default true,
  city text,
  payout_account_id text,
  payout_ready boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.tips (
  id uuid primary key,
  driver_id uuid not null references public.driver_profiles (id) on delete cascade,
  gross_cents integer not null check (gross_cents > 0),
  driver_cents integer not null check (driver_cents >= 0),
  platform_gross_fee_cents integer not null check (platform_gross_fee_cents >= 0),
  payment_provider_fee_cents integer not null default 0,
  platform_net_revenue_cents integer not null default 0,
  currency text not null default 'EUR',
  payment_status text not null default 'pending'
    check (payment_status in ('pending', 'succeeded', 'failed', 'refunded')),
  payout_status text not null default 'pending'
    check (payout_status in ('pending', 'in_balance', 'paid_out')),
  provider text not null,
  provider_payment_id text,
  -- Gesetzt, wenn der Zusteller-Anteil direkt an sein Konto geflossen ist.
  destination_account_id text,
  created_at timestamptz not null default now(),
  -- Schuetzt gegen doppelte Buchung desselben Provider-Events.
  constraint tips_provider_payment_id_unique unique (provider_payment_id)
);

create table if not exists public.thank_yous (
  id uuid primary key,
  driver_id uuid not null references public.driver_profiles (id) on delete cascade,
  preset_id text,
  message text,
  tip_id uuid references public.tips (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.verifications (
  id uuid primary key,
  user_id uuid not null unique references public.users (id) on delete cascade,
  identity_status text not null default 'unverified',
  driver_status text not null default 'unverified',
  document_note text,
  review_note text,
  updated_at timestamptz not null default now()
);

create table if not exists public.milestones (
  id uuid primary key,
  driver_id uuid not null references public.driver_profiles (id) on delete cascade,
  type text not null,
  value integer not null,
  achieved_at timestamptz not null default now(),
  constraint milestones_unique unique (driver_id, type, value)
);

create table if not exists public.admin_actions (
  id uuid primary key,
  actor_email text not null,
  target_id text not null,
  action text not null,
  reason text,
  created_at timestamptz not null default now()
);

create table if not exists public.scans (
  id uuid primary key,
  driver_id uuid not null references public.driver_profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Indizes für die Abfragen aus dem Dashboard und dem Adminbereich.
create index if not exists tips_driver_created_idx on public.tips (driver_id, created_at desc);
create index if not exists thank_yous_driver_created_idx on public.thank_yous (driver_id, created_at desc);
create index if not exists scans_driver_created_idx on public.scans (driver_id, created_at desc);
create index if not exists driver_profiles_code_idx on public.driver_profiles (lower(code));
create index if not exists users_email_idx on public.users (lower(email));
create index if not exists password_resets_user_idx on public.password_resets (user_id);

-- ---------------------------------------------------------------------------
-- Row Level Security: standardmäßig alles verboten.
-- Der Server nutzt den Service-Role-Key und umgeht RLS bewusst.
-- ---------------------------------------------------------------------------
alter table public.users enable row level security;
alter table public.password_resets enable row level security;
alter table public.driver_profiles enable row level security;
alter table public.tips enable row level security;
alter table public.thank_yous enable row level security;
alter table public.verifications enable row level security;
alter table public.milestones enable row level security;
alter table public.admin_actions enable row level security;
alter table public.scans enable row level security;
