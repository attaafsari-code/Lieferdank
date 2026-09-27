-- Auf bestehenden Supabase-Projekten vor der neuen Version ausführen.
-- Falls bereits mehrere offene Auszahlungen pro Zusteller bestehen, zuerst
-- manuell anhand der Stripe-Transfers abstimmen; der Index darf dann scheitern.
create unique index if not exists payouts_one_pending_per_driver_idx
  on public.payouts (driver_id) where status = 'pending';

-- Auch ein bereits angelegter Bucket darf Profilfotos nicht öffentlich ausliefern.
update storage.buckets
set public = false,
    file_size_limit = 2097152,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'media';

-- Erstattete Kartenbestellungen dürfen nicht als bezahlt versendet werden.
alter table public.card_orders drop constraint if exists card_orders_payment_status_check;
alter table public.card_orders add constraint card_orders_payment_status_check
  check (payment_status in ('not_required', 'pending', 'paid', 'refunded'));
