-- Convenience bundle if 010–013 were not applied yet (safe to re-run).
alter table public.game_presets
  add column if not exists rebuy_chips jsonb not null default '[{"order":1,"chips":0}]'::jsonb;

alter table public.game_presets
  add column if not exists participation_points integer not null default 0;

alter table public.game_presets
  add column if not exists prize_pool_percent integer not null default 100;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'game_presets_prize_pool_percent_check'
  ) then
    alter table public.game_presets
      add constraint game_presets_prize_pool_percent_check
      check (prize_pool_percent >= 0 and prize_pool_percent <= 100);
  end if;
end $$;

alter table public.game_presets
  add column if not exists bonus_enabled boolean not null default false;

update public.game_presets
set bonus_enabled = true
where coalesce(bonus_chips, 0) > 0 and bonus_enabled = false;
