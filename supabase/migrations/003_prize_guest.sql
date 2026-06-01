-- Prize settlement, win points, guest requests

-- Prize structure templates (%, ranks)
create table public.prize_structures (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid references public.venues (id) on delete cascade,
  name text not null,
  game_kind text not null default 'daily'
    check (game_kind in ('single', 'mtt', 'daily', 'satellite')),
  max_entries integer,
  default_payout_places integer not null default 5,
  placements jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

comment on column public.prize_structures.placements is
  '[{"rank":1,"percent":40},{"rank":2,"percent":25},...]';

create table public.win_point_presets (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid references public.venues (id) on delete cascade,
  name text not null,
  placements jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.games
  add column if not exists prize_structure_id uuid references public.prize_structures (id) on delete set null;

alter table public.games
  add column if not exists win_point_preset_id uuid references public.win_point_presets (id) on delete set null;

alter table public.games
  add column if not exists total_prize_pool bigint not null default 0;

alter table public.games
  add column if not exists payout_places integer not null default 5;

alter table public.games
  add column if not exists settlement_status text not null default 'none'
  check (settlement_status in ('none', 'in_progress', 'finalized'));

alter table public.game_finish_placements (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  member_id uuid not null references public.members (id) on delete cascade,
  finish_rank integer not null check (finish_rank >= 1),
  chips_at_elim bigint,
  suggested_amount bigint not null default 0,
  final_amount bigint not null default 0,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  unique (game_id, finish_rank),
  unique (game_id, member_id)
);

create table public.game_icm_chop (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null unique references public.games (id) on delete cascade,
  remaining_pool bigint not null default 0,
  inputs jsonb not null default '[]'::jsonb,
  results jsonb not null default '[]'::jsonb,
  finalized boolean not null default false,
  updated_at timestamptz not null default now()
);

comment on column public.game_icm_chop.inputs is
  '[{"member_id":"...","nickname":"...","chips":100000},...]';

create table public.win_point_ledger (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  member_id uuid not null references public.members (id) on delete cascade,
  game_id uuid references public.games (id) on delete set null,
  points integer not null,
  multiplier numeric(4, 2) not null default 1,
  finish_rank integer,
  created_at timestamptz not null default now()
);

-- Guest: point transfers
create table public.point_transfer_requests (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  from_member_id uuid not null references public.members (id) on delete cascade,
  to_member_id uuid not null references public.members (id) on delete cascade,
  amount integer not null check (amount > 0),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  message text,
  resolved_by uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

-- Extend approval request types
alter table public.approval_requests drop constraint if exists approval_requests_request_type_check;

alter table public.approval_requests
  add constraint approval_requests_request_type_check
  check (request_type in (
    'seat_reservation',
    'participation',
    'buy_in',
    'reservation',
    'buy_in_request',
    'point_transfer'
  ));

alter table public.approval_requests
  add column if not exists payload jsonb;

-- RLS
alter table public.prize_structures enable row level security;
alter table public.win_point_presets enable row level security;
alter table public.game_finish_placements enable row level security;
alter table public.game_icm_chop enable row level security;
alter table public.win_point_ledger enable row level security;
alter table public.point_transfer_requests enable row level security;

create policy prize_structures_select on public.prize_structures for select to authenticated using (true);
create policy prize_structures_write on public.prize_structures for all using (public.is_admin());

create policy win_point_presets_select on public.win_point_presets for select to authenticated using (true);
create policy win_point_presets_write on public.win_point_presets for all using (public.is_admin());

create policy gfp_select on public.game_finish_placements for select to authenticated using (true);
create policy gfp_write on public.game_finish_placements for all using (public.is_staff_or_admin());

create policy icm_select on public.game_icm_chop for select to authenticated using (true);
create policy icm_write on public.game_icm_chop for all using (public.is_staff_or_admin());

create policy wpl_select on public.win_point_ledger for select to authenticated using (true);
create policy wpl_insert on public.win_point_ledger for insert with check (public.is_staff_or_admin());

create policy ptr_select on public.point_transfer_requests for select to authenticated using (
  public.is_staff_or_admin()
  or from_member_id in (select m.id from public.members m where m.user_id = auth.uid())
  or to_member_id in (select m.id from public.members m where m.user_id = auth.uid())
);

create policy ptr_insert on public.point_transfer_requests for insert to authenticated
  with check (
    from_member_id in (select m.id from public.members m where m.user_id = auth.uid())
    or public.is_staff_or_admin()
  );

create policy ptr_update on public.point_transfer_requests for update using (public.is_staff_or_admin());

alter publication supabase_realtime add table public.game_finish_placements;
alter publication supabase_realtime add table public.point_transfer_requests;
