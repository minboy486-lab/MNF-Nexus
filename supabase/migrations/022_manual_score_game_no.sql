-- 게임 기록: 하루 최대 10게임 구분

alter table public.manual_score_daily
  add column if not exists game_no smallint not null default 1;

alter table public.manual_score_daily
  drop constraint if exists manual_score_daily_venue_id_play_date_nickname_key;

create unique index if not exists manual_score_daily_game_unique
  on public.manual_score_daily (venue_id, play_date, game_no, nickname);

comment on column public.manual_score_daily.game_no is '당일 게임 번호 (1부터, 3게임 단위 확장)';
