-- MNF platform: venues, sessions, members, visits, ledger, blind maps
-- 재실행 가능 (IF NOT EXISTS, 정책/realtime 중복 무시)

create table if not exists public.venues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  timezone text not null default 'Asia/Seoul',
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.venue_sessions (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  status text not null default 'open' check (status in ('open', 'closed')),
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  opened_by uuid references public.profiles (id) on delete set null,
  closed_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists venue_sessions_venue_open_idx
  on public.venue_sessions (venue_id, status)
  where status = 'open';

create table if not exists public.blind_structures (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid references public.venues (id) on delete cascade,
  template_name text not null,
  default_buy_in integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.blind_levels (
  id uuid primary key default gen_random_uuid(),
  structure_id uuid not null references public.blind_structures (id) on delete cascade,
  level_number integer not null,
  level_kind text not null default 'play' check (level_kind in ('play', 'break')),
  small_blind integer not null default 0,
  big_blind integer not null default 0,
  ante integer not null default 0,
  duration_minutes integer not null default 20,
  unique (structure_id, level_number)
);

alter table public.profiles
  add column if not exists venue_id uuid references public.venues (id) on delete set null;

alter table public.physical_tables
  add column if not exists venue_id uuid references public.venues (id) on delete cascade;

alter table public.physical_tables
  add column if not exists layout_image_url text;

alter table public.physical_tables
  add column if not exists sort_order smallint not null default 0;

do $$
begin
  if to_regclass('public.members') is null and to_regclass('public.venue_players') is not null then
    alter table public.venue_players rename to members;
  end if;
end $$;

alter table public.members
  add column if not exists venue_id uuid references public.venues (id) on delete cascade;

alter table public.members
  add column if not exists phone text;

alter table public.members
  add column if not exists point_balance bigint not null default 0;

alter table public.members
  add column if not exists credit_balance bigint not null default 0;

alter table public.members
  add column if not exists rank_tier text;

create unique index if not exists members_venue_phone_uidx
  on public.members (venue_id, phone)
  where phone is not null;

create table if not exists public.member_visits (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  venue_session_id uuid not null references public.venue_sessions (id) on delete cascade,
  member_id uuid not null references public.members (id) on delete cascade,
  checked_in_at timestamptz not null default now(),
  checked_out_at timestamptz,
  status text not null default 'on_floor' check (status in ('on_floor', 'left')),
  created_at timestamptz not null default now()
);

create index if not exists member_visits_active_idx
  on public.member_visits (venue_session_id, member_id)
  where checked_out_at is null and status = 'on_floor';

alter table public.games
  add column if not exists venue_id uuid references public.venues (id) on delete cascade;

alter table public.games
  add column if not exists venue_session_id uuid references public.venue_sessions (id) on delete set null;

alter table public.games
  add column if not exists daily_game_number integer;

alter table public.games
  add column if not exists blind_structure_id uuid references public.blind_structures (id) on delete set null;

alter table public.games
  add column if not exists rebuy_count integer not null default 0;

alter table public.games
  add column if not exists prize_detail jsonb;

alter table public.games
  add column if not exists win_point_multiplier numeric(4, 2) not null default 1;

alter table public.games drop constraint if exists games_status_check;

alter table public.games
  add constraint games_status_check
  check (status in ('scheduled', 'running', 'registration_closed', 'ended', 'settled'));

create unique index if not exists games_session_daily_number_uidx
  on public.games (venue_session_id, daily_game_number)
  where venue_session_id is not null and daily_game_number is not null;

alter table public.game_clocks
  add column if not exists version integer not null default 1;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'seats' and column_name = 'venue_player_id'
  ) then
    alter table public.seats rename column venue_player_id to member_id;
  end if;
end $$;

alter table public.seats
  add column if not exists member_visit_id uuid references public.member_visits (id) on delete set null;

alter table public.seats
  add column if not exists seat_status text not null default 'empty'
  check (seat_status in ('empty', 'occupied', 'sit_out'));

alter table public.seats
  add column if not exists first_sat_at timestamptz;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'approval_requests' and column_name = 'venue_player_id'
  ) then
    alter table public.approval_requests rename column venue_player_id to member_id;
  end if;
end $$;

create table if not exists public.money_transactions (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  venue_session_id uuid references public.venue_sessions (id) on delete set null,
  game_id uuid references public.games (id) on delete set null,
  member_id uuid references public.members (id) on delete set null,
  seat_id uuid references public.seats (id) on delete set null,
  member_visit_id uuid references public.member_visits (id) on delete set null,
  txn_type text not null check (
    txn_type in (
      'buy_in',
      'rebuy',
      'prize_payout',
      'cash_in',
      'card_in',
      'transfer_in',
      'point_spend',
      'point_earn',
      'credit_charge',
      'credit_collect',
      'refund'
    )
  ),
  amount bigint not null,
  payment_method text check (
    payment_method is null
    or payment_method in ('cash', 'card', 'transfer', 'points', 'credit')
  ),
  occurred_at timestamptz not null default now(),
  daily_closeout_id uuid,
  note text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists money_transactions_session_idx
  on public.money_transactions (venue_session_id, occurred_at);

create table if not exists public.seat_moves (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  member_id uuid not null references public.members (id) on delete cascade,
  from_physical_table_id uuid references public.physical_tables (id) on delete set null,
  from_seat_number integer,
  to_physical_table_id uuid not null references public.physical_tables (id) on delete cascade,
  to_seat_number integer not null,
  moved_at timestamptz not null default now(),
  moved_by uuid references public.profiles (id) on delete set null
);

create table if not exists public.staff (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  profile_id uuid references public.profiles (id) on delete set null,
  name text not null,
  role text not null default 'staff' check (role in ('dealer', 'manager', 'staff')),
  hourly_wage integer not null default 0,
  pin_hash text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.staff_shifts (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff (id) on delete cascade,
  venue_session_id uuid references public.venue_sessions (id) on delete set null,
  checked_in_at timestamptz not null default now(),
  checked_out_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.staff_advances (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff (id) on delete cascade,
  venue_id uuid not null references public.venues (id) on delete cascade,
  amount integer not null,
  paid_at timestamptz not null default now(),
  memo text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid references public.venues (id) on delete cascade,
  code text not null,
  label text not null,
  unique (venue_id, code)
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  venue_session_id uuid references public.venue_sessions (id) on delete set null,
  category_id uuid not null references public.expense_categories (id) on delete restrict,
  amount integer not null,
  memo text,
  spent_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.daily_closeouts (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  venue_session_id uuid not null unique references public.venue_sessions (id) on delete cascade,
  total_buy_in bigint not null default 0,
  total_prize bigint not null default 0,
  total_cash bigint not null default 0,
  total_card bigint not null default 0,
  total_transfer bigint not null default 0,
  total_point_net bigint not null default 0,
  total_credit_new bigint not null default 0,
  total_credit_collected bigint not null default 0,
  balance_delta bigint not null default 0,
  notes text,
  closed_by uuid references public.profiles (id) on delete set null,
  closed_at timestamptz,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'money_transactions_closeout_fkey'
      and conrelid = 'public.money_transactions'::regclass
  ) then
    alter table public.money_transactions
      add constraint money_transactions_closeout_fkey
      foreign key (daily_closeout_id) references public.daily_closeouts (id) on delete set null;
  end if;
end $$;

alter table public.physical_tables drop constraint if exists physical_tables_code_key;

create unique index if not exists physical_tables_venue_code_uidx
  on public.physical_tables (venue_id, code);

alter table public.venues enable row level security;
alter table public.venue_sessions enable row level security;
alter table public.blind_structures enable row level security;
alter table public.blind_levels enable row level security;
alter table public.member_visits enable row level security;
alter table public.money_transactions enable row level security;
alter table public.seat_moves enable row level security;
alter table public.staff enable row level security;
alter table public.staff_shifts enable row level security;
alter table public.staff_advances enable row level security;
alter table public.expense_categories enable row level security;
alter table public.expenses enable row level security;
alter table public.daily_closeouts enable row level security;

drop policy if exists venue_players_select on public.members;
drop policy if exists venue_players_write on public.members;

drop policy if exists members_select on public.members;
create policy members_select on public.members for select to authenticated using (true);
drop policy if exists members_write on public.members;
create policy members_write on public.members for all using (public.is_staff_or_admin());

drop policy if exists venues_select on public.venues;
create policy venues_select on public.venues for select to authenticated using (true);
drop policy if exists venues_write on public.venues;
create policy venues_write on public.venues for all using (public.is_admin());

drop policy if exists venue_sessions_select on public.venue_sessions;
create policy venue_sessions_select on public.venue_sessions for select to authenticated using (true);
drop policy if exists venue_sessions_write on public.venue_sessions;
create policy venue_sessions_write on public.venue_sessions for all using (public.is_staff_or_admin());

drop policy if exists blind_structures_select on public.blind_structures;
create policy blind_structures_select on public.blind_structures for select to authenticated using (true);
drop policy if exists blind_structures_write on public.blind_structures;
create policy blind_structures_write on public.blind_structures for all using (public.is_admin());

drop policy if exists blind_levels_select on public.blind_levels;
create policy blind_levels_select on public.blind_levels for select to authenticated using (true);
drop policy if exists blind_levels_write on public.blind_levels;
create policy blind_levels_write on public.blind_levels for all using (public.is_admin());

drop policy if exists member_visits_select on public.member_visits;
create policy member_visits_select on public.member_visits for select to authenticated using (true);
drop policy if exists member_visits_write on public.member_visits;
create policy member_visits_write on public.member_visits for all using (public.is_staff_or_admin());

drop policy if exists money_transactions_select on public.money_transactions;
create policy money_transactions_select on public.money_transactions for select to authenticated using (true);
drop policy if exists money_transactions_write on public.money_transactions;
create policy money_transactions_write on public.money_transactions for all using (public.is_staff_or_admin());

drop policy if exists seat_moves_select on public.seat_moves;
create policy seat_moves_select on public.seat_moves for select to authenticated using (true);
drop policy if exists seat_moves_insert on public.seat_moves;
create policy seat_moves_insert on public.seat_moves for insert with check (public.is_staff_or_admin());

drop policy if exists staff_select on public.staff;
create policy staff_select on public.staff for select to authenticated using (true);
drop policy if exists staff_write on public.staff;
create policy staff_write on public.staff for all using (public.is_admin());

drop policy if exists staff_shifts_select on public.staff_shifts;
create policy staff_shifts_select on public.staff_shifts for select to authenticated using (true);
drop policy if exists staff_shifts_write on public.staff_shifts;
create policy staff_shifts_write on public.staff_shifts for all using (public.is_staff_or_admin());

drop policy if exists staff_advances_select on public.staff_advances;
create policy staff_advances_select on public.staff_advances for select to authenticated using (true);
drop policy if exists staff_advances_write on public.staff_advances;
create policy staff_advances_write on public.staff_advances for all using (public.is_admin());

drop policy if exists expense_categories_select on public.expense_categories;
create policy expense_categories_select on public.expense_categories for select to authenticated using (true);
drop policy if exists expense_categories_write on public.expense_categories;
create policy expense_categories_write on public.expense_categories for all using (public.is_admin());

drop policy if exists expenses_select on public.expenses;
create policy expenses_select on public.expenses for select to authenticated using (true);
drop policy if exists expenses_write on public.expenses;
create policy expenses_write on public.expenses for all using (public.is_staff_or_admin());

drop policy if exists daily_closeouts_select on public.daily_closeouts;
create policy daily_closeouts_select on public.daily_closeouts for select to authenticated using (true);
drop policy if exists daily_closeouts_write on public.daily_closeouts;
create policy daily_closeouts_write on public.daily_closeouts for all using (public.is_admin());

do $$
declare
  t text;
begin
  foreach t in array array[
    'public.member_visits',
    'public.money_transactions',
    'public.members',
    'public.venue_sessions'
  ]
  loop
    begin
      execute format('alter publication supabase_realtime add table %s', t);
    exception
      when duplicate_object then null;
      when others then
        if sqlerrm like '%already member of publication%' then
          null;
        else
          raise;
        end if;
    end;
  end loop;
end $$;
