-- Additive only: old clients omit color and retain the existing blue default.
begin;
alter table public.card_designs add column if not exists color text not null default 'blue';
do $$ begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.card_designs'::regclass and conname = 'card_designs_color_check') then
    alter table public.card_designs add constraint card_designs_color_check check (color in ('blue', 'navy', 'teal'));
  end if;
end $$;
notify pgrst, 'reload schema';
commit;
