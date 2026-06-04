alter table public.game_presets
  add column if not exists prize_pool_percent integer not null default 100
    check (prize_pool_percent >= 0 and prize_pool_percent <= 100);

comment on column public.game_presets.prize_pool_percent is
  '총 바인(및 설정 기준) 대비 프라이즈 풀 비율(%) — 예: 바인 100만·80% → 풀 80만';
