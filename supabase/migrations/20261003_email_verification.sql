-- Vor dem Deployment der Version mit E-Mail-Bestätigung ausführen.
-- Rein additiv: bestehende Konten erhalten NULL (= noch nicht bestätigt) und bestätigen
-- über den Hinweis im Dashboard bzw. Kundenkonto. Die bisher laufende App-Version ignoriert
-- die Spalte. Ohne sie kann die neue Version keine Konten anlegen; /api/health meldet dann
-- "migration_required".
-- Ein Admin, der von Hand angelegt wird, bekommt email_verified_at = now() gleich mit.
begin;

alter table public.users add column if not exists email_verified_at timestamptz;

commit;
