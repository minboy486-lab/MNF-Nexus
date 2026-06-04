-- Phase 1c–7: button seat, rebuy timestamp, closeout lines, payroll, kakao templates

alter table public.games
  add column if not exists button_seat integer check (button_seat is null or (button_seat >= 1 and button_seat <= 11));

alter table public.seats
  add column if not exists last_rebuy_at timestamptz;

create table if not exists public.daily_closeout_lines (
  id uuid primary key default gen_random_uuid(),
  daily_closeout_id uuid not null references public.daily_closeouts (id) on delete cascade,
  line_kind text not null check (line_kind in ('game', 'member', 'detail')),
  game_id uuid references public.games (id) on delete set null,
  member_id uuid references public.members (id) on delete set null,
  label text not null,
  buy_in_total bigint not null default 0,
  prize_total bigint not null default 0,
  cash_total bigint not null default 0,
  card_total bigint not null default 0,
  transfer_total bigint not null default 0,
  point_net bigint not null default 0,
  credit_delta bigint not null default 0,
  balance bigint not null default 0,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.payroll_periods (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  year_month text not null,
  status text not null default 'open' check (status in ('open', 'closed')),
  total_gross integer not null default 0,
  total_advances integer not null default 0,
  total_net integer not null default 0,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (venue_id, year_month)
);

create table if not exists public.payroll_lines (
  id uuid primary key default gen_random_uuid(),
  payroll_period_id uuid not null references public.payroll_periods (id) on delete cascade,
  staff_id uuid not null references public.staff (id) on delete cascade,
  hours_worked numeric(8, 2) not null default 0,
  gross_pay integer not null default 0,
  advances_deducted integer not null default 0,
  net_pay integer not null default 0,
  created_at timestamptz not null default now(),
  unique (payroll_period_id, staff_id)
);

create table if not exists public.kakao_templates (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid references public.venues (id) on delete cascade,
  kind text not null check (kind in ('status', 'money_in')),
  body_template text not null,
  created_at timestamptz not null default now()
);

alter table public.daily_closeout_lines enable row level security;
alter table public.payroll_periods enable row level security;
alter table public.payroll_lines enable row level security;
alter table public.kakao_templates enable row level security;

create policy daily_closeout_lines_select on public.daily_closeout_lines for select to authenticated using (true);
create policy daily_closeout_lines_write on public.daily_closeout_lines for all using (public.is_admin());

create policy payroll_periods_select on public.payroll_periods for select to authenticated using (true);
create policy payroll_periods_write on public.payroll_periods for all using (public.is_admin());

create policy payroll_lines_select on public.payroll_lines for select to authenticated using (true);
create policy payroll_lines_write on public.payroll_lines for all using (public.is_admin());

create policy kakao_templates_select on public.kakao_templates for select to authenticated using (true);
create policy kakao_templates_write on public.kakao_templates for all using (public.is_admin());
