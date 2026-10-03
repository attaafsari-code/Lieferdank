-- =============================================================================
-- Lieferdank – Datenbankschema (Supabase / PostgreSQL)
--
-- Anwenden: Supabase Studio → SQL Editor → komplettes Skript ausführen.
-- Das Skript ist idempotent (create … if not exists) und kann erneut laufen.
--
-- Spaltennamen sind die snake_case-Form der Felder in src/lib/db/types.ts.
-- Der Adapter (src/lib/db/supabase.ts) übersetzt automatisch.
--
-- Zugriff ausschließlich serverseitig mit dem Service-Role-Key.
-- RLS ist überall aktiv und verweigert per Default alles – ein versehentlich
-- veröffentlichter anon-Key gibt damit keinen Zugriff.
-- Ausführliche Beschreibung: DATABASE.md
-- =============================================================================

-- ---------- Konten ----------------------------------------------------------

create table if not exists public.users (
  id              uuid primary key,
  email           text not null unique,
  first_name      text not null default '',
  last_name       text not null default '',
  phone           text,
  role            text not null check (role in ('driver', 'customer', 'admin')),
  password_hash   text not null,
  token_version   integer not null default 0,
  created_at      timestamptz not null default now(),
  email_verified_at timestamptz,
  blocked_at      timestamptz,
  blocked_reason  text,
  constraint users_email_lowercase check (email = lower(email))
);

create table if not exists public.driver_profiles (
  id                 uuid primary key,
  user_id            uuid not null unique references public.users (id) on delete cascade,
  code               text not null unique check (code = upper(code)),
  name_display       text not null default 'first'
                       check (name_display in ('first', 'last', 'first_initial', 'full', 'custom')),
  custom_name        text,
  photo_key          text,
  photo_public       boolean not null default true,
  provider_id        text,
  provider_public    boolean not null default true,
  tagline            text check (char_length(tagline) <= 80),
  bio                text check (char_length(bio) <= 280),
  city               text,
  verification       text not null default 'unverified'
                       check (verification in ('unverified', 'pending', 'verified', 'rejected')),
  provider_verified  boolean not null default false,
  active             boolean not null default true,
  payout_account_id  text,
  payout_ready       boolean not null default false,
  payout_sync_version integer not null default 0 check (payout_sync_version >= 0),
  notify_on_tip      boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create table if not exists public.customer_profiles (
  id          uuid primary key,
  user_id     uuid not null unique references public.users (id) on delete cascade,
  created_at  timestamptz not null default now()
);

create table if not exists public.verifications (
  id               uuid primary key,
  user_id          uuid not null unique references public.users (id) on delete cascade,
  identity_status  text not null default 'unverified',
  driver_status    text not null default 'unverified',
  document_note    text,
  review_note      text,
  updated_at       timestamptz not null default now()
);

create table if not exists public.password_resets (
  id          uuid primary key,
  user_id     uuid not null references public.users (id) on delete cascade,
  token_hash  text not null unique,           -- SHA-256, nie das Token selbst
  expires_at  timestamptz not null,
  used_at     timestamptz,
  created_at  timestamptz not null default now()
);

-- ---------- Karten ----------------------------------------------------------

create table if not exists public.card_designs (
  id             uuid primary key,
  driver_id      uuid not null unique references public.driver_profiles (id) on delete cascade,
  layout         text not null default 'classic' check (layout in ('classic', 'brand', 'personal')),
  headline       text not null check (char_length(headline) <= 60),
  show_photo     boolean not null default false,
  show_provider  boolean not null default true,
  updated_at     timestamptz not null default now()
);

-- ---------- Geld ------------------------------------------------------------

create table if not exists public.payments (
  id                   uuid primary key,
  purpose              text not null check (purpose in ('tip', 'card_order')),
  reference_id         uuid not null,
  provider             text not null,
  provider_payment_id  text unique,          -- Checkout-Session
  provider_intent_id   text,                 -- PaymentIntent, für Erstattungen
  amount_cents         integer not null check (amount_cents > 0),
  refunded_amount_cents integer not null default 0 check (refunded_amount_cents >= 0 and refunded_amount_cents <= amount_cents),
  currency             text not null default 'EUR' check (currency = 'EUR'),
  status               text not null default 'pending'
                         check (status in ('pending', 'succeeded', 'failed', 'refunded', 'review_required')),
  method               text,
  failure_reason       text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create table if not exists public.payouts (
  id                    uuid primary key,
  driver_id             uuid not null references public.driver_profiles (id) on delete restrict,
  amount_cents          integer not null check (amount_cents >= 0),
  transferred_cents     integer not null default 0 check (transferred_cents >= 0),
  fee_cents             integer not null default 0 check (fee_cents >= 0),
  status                text not null default 'pending' check (status in ('pending', 'paid', 'failed')),
  provider              text not null,
  provider_transfer_id  text,
  tip_ids               jsonb not null default '[]'::jsonb,
  failure_reason        text,
  created_at            timestamptz not null default now(),
  completed_at          timestamptz
);

create table if not exists public.tips (
  id                          uuid primary key,
  driver_id                   uuid not null references public.driver_profiles (id) on delete restrict,
  payment_id                  uuid not null unique references public.payments (id),
  customer_id                 uuid references public.users (id) on delete set null,
  gross_cents                 integer not null check (gross_cents > 0),
  driver_cents                integer not null check (driver_cents >= 0),
  platform_gross_fee_cents    integer not null check (platform_gross_fee_cents >= 0),
  payment_provider_fee_cents  integer not null default 0 check (payment_provider_fee_cents >= 0),
  payout_fee_cents            integer not null default 0 check (payout_fee_cents >= 0),
  platform_net_revenue_cents  integer not null default 0,
  refunded_cents              integer not null default 0,
  fee_refunded_cents          integer not null default 0,
  currency                    text not null default 'EUR' check (currency = 'EUR'),
  payment_status              text not null default 'pending'
                                check (payment_status in ('pending', 'succeeded', 'failed', 'refunded', 'review_required')),
  payout_status               text not null default 'pending'
                                check (payout_status in ('pending', 'in_balance', 'paid_out')),
  payout_id                   uuid references public.payouts (id),
  destination_account_id      text,
  created_at                  timestamptz not null default now(),
  -- Der Kunde zahlt exakt den Bruttobetrag: Anteil + Gebühr müssen aufgehen.
  constraint tips_split_consistent check (driver_cents + platform_gross_fee_cents = gross_cents),
  -- Erstattet werden kann höchstens der gezahlte Betrag, zurückgegeben höchstens die Gebühr.
  constraint tips_refund_bounds check (
    refunded_cents >= 0 and refunded_cents <= gross_cents and
    fee_refunded_cents >= 0 and fee_refunded_cents <= platform_gross_fee_cents
  ),
  constraint tips_direct_charge_model check (
    destination_account_id is not null and
    ((gross_cents = 200 and platform_gross_fee_cents = 50 and driver_cents = 150) or
     (gross_cents = 300 and platform_gross_fee_cents = 60 and driver_cents = 240) or
     (gross_cents = 500 and platform_gross_fee_cents = 100 and driver_cents = 400))
  )
);

create table if not exists public.thank_yous (
  id           uuid primary key,
  driver_id    uuid not null references public.driver_profiles (id) on delete cascade,
  tip_id       uuid unique references public.tips (id) on delete set null,
  customer_id  uuid references public.users (id) on delete set null,
  free_day     text,
  visitor_hash text,
  preset_id    text,
  message      text check (char_length(message) <= 140),
  created_at   timestamptz not null default now(),
  constraint thank_yous_free_identity_check check (
    (free_day is null and visitor_hash is null) or
    (tip_id is null and free_day ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' and visitor_hash ~ '^[0-9a-f]{64}$')
  )
);

create table if not exists public.card_orders (
  id                    uuid primary key,
  driver_id             uuid not null references public.driver_profiles (id) on delete restrict,
  product               text not null check (product in ('standard', 'personalized')),
  quantity              integer not null check (quantity between 1 and 50),
  unit_price_cents      integer not null default 0,
  total_cents           integer not null default 0,
  currency              text not null default 'EUR',
  payment_status        text not null default 'not_required'
                          check (payment_status in ('not_required', 'pending', 'paid', 'failed', 'refunded', 'review_required')),
  payment_id            uuid references public.payments (id),
  design                jsonb not null,       -- eingefrorener Kartenstand zum Bestellzeitpunkt
  shipping_name         text not null,
  shipping_street       text not null,
  shipping_postal_code  text not null,
  shipping_city         text not null,
  shipping_country      text not null default 'DE',
  status                text not null default 'requested'
                          check (status in ('requested', 'confirmed', 'in_production', 'shipped', 'delivered', 'cancelled')),
  carrier               text,
  tracking_number       text,
  reorder_of            uuid references public.card_orders (id),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  shipped_at            timestamptz
);

-- ---------- Kunden ----------------------------------------------------------

create table if not exists public.driver_favorites (
  id           uuid primary key,
  customer_id  uuid not null references public.users (id) on delete cascade,
  driver_id    uuid not null references public.driver_profiles (id) on delete cascade,
  nickname     text check (char_length(nickname) <= 40),
  created_at   timestamptz not null default now(),
  constraint driver_favorites_unique unique (customer_id, driver_id)
);

-- ---------- Auswertung & Betrieb -------------------------------------------

create table if not exists public.milestones (
  id           uuid primary key,
  driver_id    uuid not null references public.driver_profiles (id) on delete cascade,
  type         text not null,
  value        integer not null,
  achieved_at  timestamptz not null default now(),
  constraint milestones_unique unique (driver_id, type, value)
);

create table if not exists public.scans (
  id          uuid primary key,
  driver_id   uuid not null references public.driver_profiles (id) on delete cascade,
  created_at  timestamptz not null default now()
);

create table if not exists public.admin_actions (
  id           uuid primary key,
  actor_email  text not null,
  target_id    text not null,
  action       text not null,
  reason       text,
  created_at   timestamptz not null default now()
);

create table if not exists public.system_events (
  id          uuid primary key,
  level       text not null check (level in ('info', 'warning', 'error')),
  source      text not null,
  message     text not null,
  context     jsonb,
  created_at  timestamptz not null default now()
);

-- ---------- Indizes ---------------------------------------------------------

create index if not exists tips_driver_created_idx        on public.tips (driver_id, created_at desc);
create index if not exists tips_status_idx                on public.tips (payment_status, payout_status);
create index if not exists tips_customer_idx              on public.tips (customer_id) where customer_id is not null;
create index if not exists tips_created_idx               on public.tips (created_at desc);
create index if not exists thank_yous_driver_created_idx  on public.thank_yous (driver_id, created_at desc);
create index if not exists thank_yous_customer_idx        on public.thank_yous (customer_id) where customer_id is not null;
create index if not exists thank_yous_created_idx         on public.thank_yous (created_at desc);
create unique index if not exists thank_yous_free_daily_visitor_idx on public.thank_yous (driver_id, free_day, visitor_hash)
  where tip_id is null and visitor_hash is not null;
create unique index if not exists thank_yous_free_daily_customer_idx on public.thank_yous (driver_id, free_day, customer_id)
  where tip_id is null and customer_id is not null and free_day is not null;
create index if not exists scans_driver_created_idx       on public.scans (driver_id, created_at desc);
create index if not exists scans_created_idx              on public.scans (created_at desc);
create unique index if not exists payments_intent_idx     on public.payments (provider_intent_id) where provider_intent_id is not null;
create index if not exists payments_reference_idx         on public.payments (reference_id);
create unique index if not exists driver_profiles_connect_unique_idx on public.driver_profiles (payout_account_id) where payout_account_id is not null;
create unique index if not exists payouts_transfer_unique_idx on public.payouts (provider_transfer_id) where provider_transfer_id is not null;
create unique index if not exists card_orders_payment_unique_idx on public.card_orders (payment_id) where payment_id is not null;
create index if not exists payouts_driver_idx             on public.payouts (driver_id, created_at desc);
-- Verhindert zwei gleichzeitige Transfers desselben offenen Guthabens.
create unique index if not exists payouts_one_pending_per_driver_idx on public.payouts (driver_id) where status = 'pending';
create index if not exists card_orders_driver_idx         on public.card_orders (driver_id, created_at desc);
create index if not exists card_orders_status_idx         on public.card_orders (status);
create index if not exists driver_favorites_customer_idx  on public.driver_favorites (customer_id, created_at desc);
create index if not exists password_resets_user_idx       on public.password_resets (user_id);
create index if not exists milestones_driver_idx          on public.milestones (driver_id, achieved_at desc);
create index if not exists system_events_created_idx      on public.system_events (created_at desc);
create index if not exists admin_actions_created_idx      on public.admin_actions (created_at desc);

-- ---------- Row Level Security: standardmäßig alles verboten ----------------

alter table public.users              enable row level security;
alter table public.driver_profiles    enable row level security;
alter table public.customer_profiles  enable row level security;
alter table public.verifications      enable row level security;
alter table public.password_resets    enable row level security;
alter table public.card_designs       enable row level security;
alter table public.payments           enable row level security;
alter table public.payouts            enable row level security;
alter table public.tips               enable row level security;
alter table public.thank_yous         enable row level security;
alter table public.card_orders        enable row level security;
alter table public.driver_favorites   enable row level security;
alter table public.milestones         enable row level security;
alter table public.scans              enable row level security;
alter table public.admin_actions      enable row level security;
alter table public.system_events      enable row level security;

-- ---------- Tabellenrechte: nur der Service-Role-Key -----------------------
-- Neuere Supabase-Projekte vergeben für per SQL angelegte Tabellen keine
-- Standardrechte mehr an die API-Rollen. Ohne diese Zeilen scheitert jeder
-- Zugriff mit „permission denied for table …“. anon/authenticated bleiben
-- bewusst ohne Rechte (zusätzlich zu RLS).

grant usage on schema public to service_role;
grant select, insert, update, delete on all tables in schema public to service_role;
revoke all on all tables in schema public from anon, authenticated;

-- ---------- Dateispeicher für Profilfotos ----------------------------------
-- Privat: Ausgeliefert wird nur über /api/media/avatar/[driverId], das die
-- Sichtbarkeit prüft. Kein öffentlicher Bucket, keine erratbaren URLs.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
