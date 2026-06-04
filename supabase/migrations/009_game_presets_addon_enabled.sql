alter table public.game_presets
  add column if not exists addon_enabled boolean not null default false;

update public.game_presets
set addon_enabled = true
where addon_price > 0 or addon_chips > 0;
