-- Vor dem Deployment der Version mit versioniertem Stripe-Abgleich ausführen.
-- Rein additiv: bestehende Zeilen erhalten 0, die bisher laufende App-Version
-- ignoriert die Spalte. Ohne diese Spalte schlagen Registrierung und Kontoabgleich
-- der neuen Version fehl (geschlossen – payout_ready wird dann nicht verändert).
begin;

alter table public.driver_profiles add column if not exists payout_sync_version integer not null default 0;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'driver_profiles_payout_sync_version_check'
    and conrelid = 'public.driver_profiles'::regclass) then
    alter table public.driver_profiles add constraint driver_profiles_payout_sync_version_check
      check (payout_sync_version >= 0);
  end if;
end $$;

commit;
