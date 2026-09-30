-- Vor dem Deployment der täglichen Danke-Begrenzung ausführen. Bestehende Zeilen
-- bleiben unberührt und zählen rückwirkend nicht als Besuchersperre.
begin;

alter table public.thank_yous add column if not exists free_day text;
alter table public.thank_yous add column if not exists visitor_hash text;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'thank_yous_free_identity_check'
    and conrelid = 'public.thank_yous'::regclass) then
    alter table public.thank_yous add constraint thank_yous_free_identity_check check (
      (free_day is null and visitor_hash is null) or
      (tip_id is null and free_day ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' and visitor_hash ~ '^[0-9a-f]{64}$')
    );
  end if;
end $$;

create unique index if not exists thank_yous_free_daily_visitor_idx on public.thank_yous (driver_id, free_day, visitor_hash)
  where tip_id is null and visitor_hash is not null;
create unique index if not exists thank_yous_free_daily_customer_idx on public.thank_yous (driver_id, free_day, customer_id)
  where tip_id is null and customer_id is not null and free_day is not null;

commit;
