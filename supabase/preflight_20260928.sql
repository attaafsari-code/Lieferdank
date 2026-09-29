-- Read-only preflight for the owner before applying either migration.
-- Every row returned below needs Stripe / data review; do not delete records
-- merely to make a unique index pass.

select 'duplicate_payment_intent' as issue, provider_intent_id as identifier, count(*) as rows
from public.payments where provider_intent_id is not null
group by provider_intent_id having count(*) > 1;

select 'duplicate_connect_account' as issue, payout_account_id as identifier, count(*) as rows
from public.driver_profiles where payout_account_id is not null
group by payout_account_id having count(*) > 1;

select 'duplicate_transfer' as issue, provider_transfer_id as identifier, count(*) as rows
from public.payouts where provider_transfer_id is not null
group by provider_transfer_id having count(*) > 1;

select 'duplicate_card_payment' as issue, payment_id::text as identifier, count(*) as rows
from public.card_orders where payment_id is not null
group by payment_id having count(*) > 1;

select 'pending_payout' as issue, id::text as identifier, 1 as rows
from public.payouts where status = 'pending';

select 'invalid_currency' as issue, id::text as identifier, 1 as rows
from public.payments where currency <> 'EUR'
union all
select 'invalid_currency', id::text, 1 from public.tips where currency <> 'EUR';

select 'negative_estimated_fee' as issue, id::text as identifier, 1 as rows
from public.tips where payment_provider_fee_cents < 0 or payout_fee_cents < 0;

select 'duplicate_pending_payouts' as issue, driver_id::text as identifier, count(*) as rows
from public.payouts where status = 'pending'
group by driver_id having count(*) > 1;

select 'demo_payment_in_supabase' as issue, id::text as identifier, 1 as rows
from public.payments where provider = 'demo';

select 'demo_connect_account' as issue, id::text as identifier, 1 as rows
from public.driver_profiles where payout_account_id like 'demo_%';

select 'legacy_tip_model' as issue, id::text as identifier, 1 as rows
from public.tips where destination_account_id is null or not (
  (gross_cents = 200 and platform_gross_fee_cents = 50 and driver_cents = 150) or
  (gross_cents = 300 and platform_gross_fee_cents = 60 and driver_cents = 240) or
  (gross_cents = 500 and platform_gross_fee_cents = 100 and driver_cents = 400)
);

select 'missing_media_bucket' as issue, 'media' as identifier, 1 as rows
where not exists (select 1 from storage.buckets where id = 'media');

-- Expected: 16 rows, all rls_enabled = true.
select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' and c.relname in
  ('users', 'driver_profiles', 'customer_profiles', 'verifications',
   'password_resets', 'card_designs', 'payments', 'payouts', 'tips',
   'thank_yous', 'card_orders', 'driver_favorites', 'milestones',
   'scans', 'admin_actions', 'system_events')
order by c.relname;

-- Expected: no rows for these app tables.
select schemaname, tablename, policyname from pg_policies
where schemaname = 'public' and tablename in
  ('users', 'driver_profiles', 'customer_profiles', 'verifications',
   'password_resets', 'card_designs', 'payments', 'payouts', 'tips',
   'thank_yous', 'card_orders', 'driver_favorites', 'milestones',
   'scans', 'admin_actions', 'system_events');
