-- MNF HOLDEM initial schema (재실행 가능: 이미 있는 테이블/정책은 건너뜀)

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'guest' check (role in ('admin', 'staff', 'guest')),
  display_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.physical_tables (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code in ('A', 'B', 'C', 'D')),
  label text not null,
  is_active boolean not null default true,
  current_game_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.game_presets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  buy_in integer not null default 0,
  blind_structure jsonb not null default '[]'::jsonb,
  prize_rules jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  preset_id uuid references public.game_presets (id) on delete set null,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'running', 'registration_closed', 'ended')),
  mode text not null default 'single_table'
    check (mode in ('single_table', 'multi_table')),
  registration_closed boolean not null default false,
  entry_count integer not null default 0,
  survivor_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'physical_tables_current_game_id_fkey'
      and conrelid = 'public.physical_tables'::regclass
  ) then
    alter table public.physical_tables
      add constraint physical_tables_current_game_id_fkey
      foreign key (current_game_id) references public.games (id) on delete set null;
  end if;
end $$;

create table if not exists public.game_table_assignments (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  physical_table_id uuid not null references public.physical_tables (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (game_id, physical_table_id)
);

create table if not exists public.game_clocks (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null unique references public.games (id) on delete cascade,
  level integer not null default 1,
  remaining_seconds integer not null default 1200,
  blind_small integer not null default 100,
  blind_big integer not null default 200,
  ante integer not null default 0,
  is_running boolean not null default false,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.venue_players (
  id uuid primary key default gen_random_uuid(),
  nickname text not null,
  floor_status text not null default 'visitor'
    check (floor_status in ('visitor', 'waiting', 'in_game', 'reserved')),
  user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.seats (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  physical_table_id uuid not null references public.physical_tables (id) on delete cascade,
  seat_number integer not null check (seat_number between 1 and 11),
  venue_player_id uuid references public.venue_players (id) on delete set null,
  chips bigint not null default 0,
  rebuy_count integer not null default 0,
  created_at timestamptz not null default now(),
  unique (game_id, physical_table_id, seat_number)
);

create table if not exists public.approval_requests (
  id uuid primary key default gen_random_uuid(),
  request_type text not null
    check (request_type in ('seat_reservation', 'participation', 'buy_in')),
  venue_player_id uuid not null references public.venue_players (id) on delete cascade,
  game_id uuid references public.games (id) on delete cascade,
  physical_table_id uuid references public.physical_tables (id) on delete set null,
  seat_number integer check (seat_number between 1 and 11),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  approved_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.game_logs (
  id uuid primary key default gen_random_uuid(),
  game_id uuid references public.games (id) on delete set null,
  physical_table_id uuid references public.physical_tables (id) on delete set null,
  level text not null default 'info',
  message text not null,
  created_at timestamptz not null default now()
);

create or replace function public.is_staff_or_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('admin', 'staff')
  );
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  );
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, role, display_name)
  values (new.id, 'guest', coalesce(new.raw_user_meta_data->>'display_name', new.email))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.physical_tables enable row level security;
alter table public.game_presets enable row level security;
alter table public.games enable row level security;
alter table public.game_table_assignments enable row level security;
alter table public.game_clocks enable row level security;
alter table public.venue_players enable row level security;
alter table public.seats enable row level security;
alter table public.approval_requests enable row level security;
alter table public.game_logs enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles for select using (auth.uid() = id);
drop policy if exists profiles_select_staff on public.profiles;
create policy profiles_select_staff on public.profiles for select using (public.is_staff_or_admin());
drop policy if exists profiles_update_admin on public.profiles;
create policy profiles_update_admin on public.profiles for update using (public.is_admin());

drop policy if exists physical_tables_select on public.physical_tables;
create policy physical_tables_select on public.physical_tables for select to authenticated using (true);
drop policy if exists physical_tables_write on public.physical_tables;
create policy physical_tables_write on public.physical_tables for all using (public.is_staff_or_admin());

drop policy if exists presets_select on public.game_presets;
create policy presets_select on public.game_presets for select to authenticated using (true);
drop policy if exists presets_admin on public.game_presets;
create policy presets_admin on public.game_presets for all using (public.is_admin());

drop policy if exists games_select on public.games;
create policy games_select on public.games for select to authenticated using (true);
drop policy if exists games_write on public.games;
create policy games_write on public.games for all using (public.is_staff_or_admin());

drop policy if exists gta_select on public.game_table_assignments;
create policy gta_select on public.game_table_assignments for select to authenticated using (true);
drop policy if exists gta_write on public.game_table_assignments;
create policy gta_write on public.game_table_assignments for all using (public.is_staff_or_admin());

drop policy if exists clocks_select on public.game_clocks;
create policy clocks_select on public.game_clocks for select to authenticated using (true);
drop policy if exists clocks_write on public.game_clocks;
create policy clocks_write on public.game_clocks for all using (public.is_staff_or_admin());

drop policy if exists venue_players_select on public.venue_players;
create policy venue_players_select on public.venue_players for select to authenticated using (true);
drop policy if exists venue_players_write on public.venue_players;
create policy venue_players_write on public.venue_players for all using (public.is_staff_or_admin());

drop policy if exists seats_select on public.seats;
create policy seats_select on public.seats for select to authenticated using (true);
drop policy if exists seats_write on public.seats;
create policy seats_write on public.seats for all using (public.is_staff_or_admin());

drop policy if exists logs_select on public.game_logs;
create policy logs_select on public.game_logs for select to authenticated using (true);
drop policy if exists logs_write on public.game_logs;
create policy logs_write on public.game_logs for insert with check (public.is_staff_or_admin());

drop policy if exists approval_select on public.approval_requests;
create policy approval_select on public.approval_requests for select to authenticated using (true);
drop policy if exists approval_insert on public.approval_requests;
create policy approval_insert on public.approval_requests for insert to authenticated
  with check (public.is_staff_or_admin() or true);
drop policy if exists approval_staff on public.approval_requests;
create policy approval_staff on public.approval_requests for update using (public.is_staff_or_admin());

do $$
declare
  t text;
begin
  foreach t in array array[
    'public.games',
    'public.game_clocks',
    'public.game_table_assignments',
    'public.seats',
    'public.venue_players',
    'public.physical_tables',
    'public.game_logs'
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
