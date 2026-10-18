begin;
-- Ranks are derived, never writable by drivers. Rewards are PREVIEW ONLY.
create table if not exists public.reward_definitions (
  id                uuid primary key,
  threshold         integer not null unique check (threshold in (500, 1000, 2000, 5000, 10000)),
  content_draft     text not null default '' check (char_length(content_draft) <= 1000),
  conditions_draft  text not null default '' check (char_length(conditions_draft) <= 4000),
  updated_at        timestamptz not null default now()
);
create table if not exists public.reward_entitlements (
  id           uuid primary key,
  driver_id    uuid not null references public.driver_profiles (id) on delete cascade,
  threshold    integer not null check (threshold in (500, 1000, 2000, 5000, 10000)),
  unlocked_at  timestamptz not null default now(),
  claimed_at   timestamptz check (claimed_at is null or claimed_at >= unlocked_at),
  constraint reward_entitlements_driver_threshold_key unique (driver_id, threshold)
);
alter table public.reward_definitions enable row level security;
alter table public.reward_entitlements enable row level security;
revoke all on public.reward_definitions, public.reward_entitlements from public, anon, authenticated;
grant select, insert, update, delete on public.reward_definitions, public.reward_entitlements to service_role;

-- Security-invoker view inherits default-deny RLS from driver_profiles / thank_yous / tips.
-- A paid thank-you counts only while its own driver's tip still has a succeeded remainder.
create or replace view public.driver_rank_counts with (security_invoker = true) as
select d.id, count(t.id) filter (
  where (t.customer_id is null or t.customer_id <> d.user_id)
    and (t.tip_id is null or (p.driver_id = d.id and p.payment_status = 'succeeded' and coalesce(p.refunded_cents, 0) < p.gross_cents))
) as thank_you_count
from public.driver_profiles d
left join public.thank_yous t on t.driver_id = d.id
left join public.tips p on p.id = t.tip_id
group by d.id;
revoke all on public.driver_rank_counts from public, anon, authenticated;
grant select on public.driver_rank_counts to service_role;

alter table public.card_designs drop constraint if exists card_designs_color_check;
alter table public.card_designs add constraint card_designs_color_check check (color in ('blue', 'navy', 'teal', 'bronze', 'copper', 'silver', 'gold', 'platinum', 'diamond', 'legend'));

-- Existing accepted thanks are taken into account; never create claims or fulfilment.
insert into public.reward_entitlements (id, driver_id, threshold, unlocked_at, claimed_at)
select gen_random_uuid(), c.id, r.threshold, now(), null
from public.driver_rank_counts c
cross join (values (500), (1000), (2000), (5000), (10000)) r(threshold)
where c.thank_you_count >= r.threshold
on conflict (driver_id, threshold) do nothing;
notify pgrst, 'reload schema';
commit;
