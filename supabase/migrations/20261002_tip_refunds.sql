-- Vor dem Deployment der Version mit Erstattungen (vollständig und anteilig) ausführen.
-- Rein additiv: bestehende Trinkgelder erhalten 0 / 0, die bisher laufende App-Version
-- ignoriert die Spalten. Ohne diese Spalten kann die neue Version keine Trinkgelder
-- anlegen und keine Erstattungen verbuchen (geschlossen – es wird nichts falsch gebucht).
begin;

alter table public.tips add column if not exists refunded_cents integer not null default 0;
alter table public.tips add column if not exists fee_refunded_cents integer not null default 0;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'tips_refund_bounds'
    and conrelid = 'public.tips'::regclass) then
    alter table public.tips add constraint tips_refund_bounds check (
      refunded_cents >= 0 and refunded_cents <= gross_cents and
      fee_refunded_cents >= 0 and fee_refunded_cents <= platform_gross_fee_cents
    );
  end if;
end $$;

commit;
