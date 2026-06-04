alter table public.game_presets
  add column if not exists participation_points integer not null default 0;

comment on column public.game_presets.participation_points is
  '게임 1회 참여 시 부여 승점 (리바인 횟수와 무관)';
