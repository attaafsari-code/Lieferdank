-- Before deployment, check for duplicate provider_intent_id values and
-- reconcile them against Stripe. This migration fails rather than guessing.
begin;

alter table public.payments add column if not exists refunded_amount_cents integer not null default 0;
alter table public.payments drop constraint if exists payments_refunded_amount_cents_check;
alter table public.payments add constraint payments_refunded_amount_cents_check
  check (refunded_amount_cents >= 0 and refunded_amount_cents <= amount_cents);

create unique index if not exists driver_profiles_connect_unique_idx on public.driver_profiles (payout_account_id)
  where payout_account_id is not null;
create unique index if not exists payouts_transfer_unique_idx on public.payouts (provider_transfer_id)
  where provider_transfer_id is not null;
create unique index if not exists card_orders_payment_unique_idx on public.card_orders (payment_id)
  where payment_id is not null;

alter table public.payments drop constraint if exists payments_currency_check;
alter table public.payments add constraint payments_currency_check check (currency = 'EUR');
alter table public.tips drop constraint if exists tips_currency_check;
alter table public.tips add constraint tips_currency_check check (currency = 'EUR');
alter table public.tips drop constraint if exists tips_payment_provider_fee_cents_check;
alter table public.tips add constraint tips_payment_provider_fee_cents_check check (payment_provider_fee_cents >= 0);
alter table public.tips drop constraint if exists tips_payout_fee_cents_check;
alter table public.tips add constraint tips_payout_fee_cents_check check (payout_fee_cents >= 0);

-- Keine neuen Trinkgelder ohne Direct-Charge-Ziel. Production hatte vor
-- dieser Umstellung keine payments; der Preflight meldet Altlasten explizit.
alter table public.tips drop constraint if exists tips_direct_charge_model;
alter table public.tips add constraint tips_direct_charge_model check (
  destination_account_id is not null and
  ((gross_cents = 200 and platform_gross_fee_cents = 50 and driver_cents = 150) or
   (gross_cents = 300 and platform_gross_fee_cents = 60 and driver_cents = 240) or
   (gross_cents = 500 and platform_gross_fee_cents = 100 and driver_cents = 400))
);

drop index if exists public.payments_intent_idx;
create unique index payments_intent_idx on public.payments (provider_intent_id)
  where provider_intent_id is not null;

alter table public.payments drop constraint if exists payments_status_check;
alter table public.payments add constraint payments_status_check
  check (status in ('pending', 'succeeded', 'failed', 'refunded', 'review_required'));

alter table public.tips drop constraint if exists tips_payment_status_check;
alter table public.tips add constraint tips_payment_status_check
  check (payment_status in ('pending', 'succeeded', 'failed', 'refunded', 'review_required'));

alter table public.card_orders drop constraint if exists card_orders_payment_status_check;
alter table public.card_orders add constraint card_orders_payment_status_check
  check (payment_status in ('not_required', 'pending', 'paid', 'failed', 'refunded', 'review_required'));

-- Existing refunded rows have no trustworthy cumulative Stripe amount: the
-- former code conflated partial and full refunds. Quarantine them for review.
update public.payments set status = 'review_required',
  failure_reason = 'Historische Erstattung: Betrag und Transfer manuell abgleichen'
where status = 'refunded' and refunded_amount_cents = 0;
update public.tips t set payment_status = 'review_required'
from public.payments p where t.payment_id = p.id and p.status = 'review_required' and t.payment_status = 'refunded';
update public.card_orders c set payment_status = 'review_required'
from public.payments p where c.payment_id = p.id and p.status = 'review_required' and c.payment_status = 'refunded';

commit;
