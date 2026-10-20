begin;
-- Existing and newly created cards retain their current visible badge by default.
alter table public.card_designs add column if not exists show_rank_badge boolean not null default true;
notify pgrst, 'reload schema';
commit;
