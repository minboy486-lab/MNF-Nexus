alter table public.game_presets
  add column if not exists bonus_chips bigint not null default 0;

comment on column public.game_presets.prize_rules is
  '{"placements":[{"rank":1,"percent":50}],"win_points":[{"rank":1,"points":100}]}';
