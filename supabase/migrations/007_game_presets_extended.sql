-- Extended game preset fields (blind maps)
alter table public.game_presets
  add column if not exists game_kind text not null default 'daily'
    check (game_kind in ('daily', 'tournament')),
  add column if not exists rebuy_cost integer not null default 0,
  add column if not exists addon_price integer not null default 0,
  add column if not exists buy_in_chips bigint not null default 0,
  add column if not exists rebuy1_chips bigint not null default 0,
  add column if not exists rebuy2_chips bigint not null default 0,
  add column if not exists addon_chips bigint not null default 0;

comment on column public.game_presets.prize_rules is
  '{"placements":[{"rank":1,"percent":50},...]}';
