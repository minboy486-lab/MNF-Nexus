-- 임시 승점·출석 기록 (엑셀 게임참가/승점표 대체)

create table if not exists public.manual_score_daily (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  member_id uuid references public.members (id) on delete set null,
  play_date date not null,
  nickname text not null,
  buy_in_points integer not null default 0,
  rebuy_points integer not null default 0,
  money_in_points integer not null default 0,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (venue_id, play_date, nickname)
);

create index if not exists manual_score_daily_date_idx
  on public.manual_score_daily (venue_id, play_date desc);

create index if not exists manual_score_daily_nickname_idx
  on public.manual_score_daily (venue_id, nickname);

comment on table public.manual_score_daily is '날짜·닉네임당 1행, 같은 날 점수 누적 (출석은 play_date 1회)';

alter table public.manual_score_daily enable row level security;

drop policy if exists manual_score_daily_select on public.manual_score_daily;
create policy manual_score_daily_select on public.manual_score_daily
  for select to authenticated using (true);

drop policy if exists manual_score_daily_write on public.manual_score_daily;
create policy manual_score_daily_write on public.manual_score_daily
  for all using (public.is_staff_or_admin());
