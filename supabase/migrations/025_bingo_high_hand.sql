-- 빙고(월별) · 하이핸드(일별) 관리

create table if not exists public.bingo_month_settings (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  month_key text not null,
  cell_labels jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (venue_id, month_key)
);

create table if not exists public.bingo_marks (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  month_key text not null,
  cell_no smallint not null check (cell_no between 1 and 16),
  nickname text not null,
  member_id uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (venue_id, month_key, cell_no, nickname)
);

create index if not exists bingo_marks_month_idx
  on public.bingo_marks (venue_id, month_key, cell_no);

create table if not exists public.high_hand_daily (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  play_date date not null,
  hand_type text not null check (hand_type in ('four_kind', 'straight_flush', 'royal_flush')),
  nickname text not null,
  member_id uuid references public.members (id) on delete set null,
  mp_points integer not null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (venue_id, play_date, hand_type)
);

create index if not exists high_hand_daily_date_idx
  on public.high_hand_daily (venue_id, play_date desc);

comment on table public.bingo_month_settings is '월별 빙고 미션 라벨 (16칸)';
comment on table public.bingo_marks is '월별 빙고 칸 완료 기록';
comment on table public.high_hand_daily is '일별 하이핸드 (포카드·스티플·로티플)';

alter table public.bingo_month_settings enable row level security;
alter table public.bingo_marks enable row level security;
alter table public.high_hand_daily enable row level security;

drop policy if exists bingo_month_settings_select on public.bingo_month_settings;
create policy bingo_month_settings_select on public.bingo_month_settings
  for select to authenticated using (true);

drop policy if exists bingo_month_settings_write on public.bingo_month_settings;
create policy bingo_month_settings_write on public.bingo_month_settings
  for all using (public.is_staff_or_admin());

drop policy if exists bingo_marks_select on public.bingo_marks;
create policy bingo_marks_select on public.bingo_marks
  for select to authenticated using (true);

drop policy if exists bingo_marks_write on public.bingo_marks;
create policy bingo_marks_write on public.bingo_marks
  for all using (public.is_staff_or_admin());

drop policy if exists high_hand_daily_select on public.high_hand_daily;
create policy high_hand_daily_select on public.high_hand_daily
  for select to authenticated using (true);

drop policy if exists high_hand_daily_write on public.high_hand_daily;
create policy high_hand_daily_write on public.high_hand_daily
  for all using (public.is_staff_or_admin());
