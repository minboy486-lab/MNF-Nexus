alter table public.game_presets
  add column if not exists bonus_enabled boolean not null default false;

update public.game_presets
set bonus_enabled = true
where coalesce(bonus_chips, 0) > 0;
