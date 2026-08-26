-- 역삼/미사 2지점: profile_venues, 미사 venue, 설정 복사, 타이머 control_pin
-- 재실행 가능

create extension if not exists pgcrypto;

alter table public.venues
  add column if not exists code text;

update public.venues
set
  name = '역삼점',
  code = 'yeoksam'
where id = '00000000-0000-4000-8000-000000000001';

insert into public.venues (id, name, timezone, code, settings)
values (
  '00000000-0000-4000-8000-000000000002',
  '미사점',
  'Asia/Seoul',
  'misa',
  '{}'::jsonb
)
on conflict (id) do update
set name = excluded.name,
    code = excluded.code;

create unique index if not exists venues_code_uidx
  on public.venues (code)
  where code is not null;

-- 초기 타이머 지점 비밀번호 1234 (sha256 hex of mnf-control-pin:1234)
update public.venues
set settings = coalesce(settings, '{}'::jsonb)
  || jsonb_build_object(
    'control_pin',
    encode(digest('mnf-control-pin:1234', 'sha256'), 'hex')
  )
where id in (
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000002'
)
  and coalesce(settings->>'control_pin', '') = '';

create table if not exists public.profile_venues (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  venue_id uuid not null references public.venues (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, venue_id)
);

create index if not exists profile_venues_venue_idx
  on public.profile_venues (venue_id);

alter table public.profile_venues enable row level security;

drop policy if exists profile_venues_select on public.profile_venues;
create policy profile_venues_select on public.profile_venues
  for select to authenticated
  using (profile_id = auth.uid() or public.is_admin());

drop policy if exists profile_venues_write on public.profile_venues;
create policy profile_venues_write on public.profile_venues
  for all
  using (public.is_admin())
  with check (public.is_admin());

-- 기존 프로필 → 역삼. 관리자는 미사도.
insert into public.profile_venues (profile_id, venue_id)
select p.id, coalesce(p.venue_id, '00000000-0000-4000-8000-000000000001')
from public.profiles p
where coalesce(p.venue_id, '00000000-0000-4000-8000-000000000001') is not null
on conflict do nothing;

insert into public.profile_venues (profile_id, venue_id)
select p.id, '00000000-0000-4000-8000-000000000002'
from public.profiles p
where p.role = 'admin'
on conflict do nothing;

update public.profiles
set venue_id = '00000000-0000-4000-8000-000000000001'
where venue_id is null
  and role in ('admin', 'manager', 'staff', 'screen', 'counter');

alter table public.game_presets
  add column if not exists venue_id uuid references public.venues (id) on delete cascade;

update public.game_presets
set venue_id = '00000000-0000-4000-8000-000000000001'
where venue_id is null;

create index if not exists game_presets_venue_idx
  on public.game_presets (venue_id);

-- 같은 지점·같은 계정에 staff 행이 여러 개면 하나 남기고 출퇴근/가불을 옮김
do $$
declare
  r record;
  keep_id uuid;
begin
  for r in
    select venue_id, profile_id
    from public.staff
    where profile_id is not null
    group by venue_id, profile_id
    having count(*) > 1
  loop
    select s.id into keep_id
    from public.staff s
    where s.venue_id = r.venue_id
      and s.profile_id = r.profile_id
    order by s.is_active desc, s.created_at desc
    limit 1;

    delete from public.payroll_lines p
    using public.staff x
    where p.staff_id = x.id
      and x.venue_id = r.venue_id
      and x.profile_id = r.profile_id
      and x.id <> keep_id
      and exists (
        select 1
        from public.payroll_lines k
        where k.payroll_period_id = p.payroll_period_id
          and k.staff_id = keep_id
      );

    update public.payroll_lines p
    set staff_id = keep_id
    from public.staff x
    where p.staff_id = x.id
      and x.venue_id = r.venue_id
      and x.profile_id = r.profile_id
      and x.id <> keep_id;

    update public.staff_shifts s
    set staff_id = keep_id
    from public.staff x
    where s.staff_id = x.id
      and x.venue_id = r.venue_id
      and x.profile_id = r.profile_id
      and x.id <> keep_id;

    update public.staff_advances a
    set staff_id = keep_id
    from public.staff x
    where a.staff_id = x.id
      and x.venue_id = r.venue_id
      and x.profile_id = r.profile_id
      and x.id <> keep_id;

    delete from public.staff
    where venue_id = r.venue_id
      and profile_id = r.profile_id
      and id <> keep_id;
  end loop;
end $$;

create unique index if not exists staff_venue_profile_uidx
  on public.staff (venue_id, profile_id)
  where profile_id is not null;

-- ── 미사에 설정만 복사 (운영 데이터는 복사하지 않음) ──────────────

insert into public.physical_tables (venue_id, code, label, is_active, sort_order, layout_image_url)
select
  '00000000-0000-4000-8000-000000000002',
  t.code,
  t.label,
  t.is_active,
  t.sort_order,
  t.layout_image_url
from public.physical_tables t
where t.venue_id = '00000000-0000-4000-8000-000000000001'
  and not exists (
    select 1 from public.physical_tables x
    where x.venue_id = '00000000-0000-4000-8000-000000000002' and x.code = t.code
  );

insert into public.expense_categories (venue_id, code, label)
select
  '00000000-0000-4000-8000-000000000002',
  e.code,
  e.label
from public.expense_categories e
where e.venue_id = '00000000-0000-4000-8000-000000000001'
  and not exists (
    select 1 from public.expense_categories x
    where x.venue_id = '00000000-0000-4000-8000-000000000002' and x.code = e.code
  );

insert into public.prize_structures (
  venue_id, name, game_kind, max_entries, default_payout_places, placements
)
select
  '00000000-0000-4000-8000-000000000002',
  p.name,
  p.game_kind,
  p.max_entries,
  p.default_payout_places,
  p.placements
from public.prize_structures p
where p.venue_id = '00000000-0000-4000-8000-000000000001'
  and not exists (
    select 1 from public.prize_structures x
    where x.venue_id = '00000000-0000-4000-8000-000000000002' and x.name = p.name
  );

insert into public.win_point_presets (venue_id, name, placements)
select
  '00000000-0000-4000-8000-000000000002',
  w.name,
  w.placements
from public.win_point_presets w
where w.venue_id = '00000000-0000-4000-8000-000000000001'
  and not exists (
    select 1 from public.win_point_presets x
    where x.venue_id = '00000000-0000-4000-8000-000000000002' and x.name = w.name
  );

insert into public.kakao_templates (venue_id, kind, body_template)
select
  '00000000-0000-4000-8000-000000000002',
  k.kind,
  k.body_template
from public.kakao_templates k
where k.venue_id = '00000000-0000-4000-8000-000000000001'
  and not exists (
    select 1 from public.kakao_templates x
    where x.venue_id = '00000000-0000-4000-8000-000000000002' and x.kind = k.kind
  );

insert into public.game_presets (
  venue_id,
  name,
  buy_in,
  blind_structure,
  prize_rules,
  game_kind,
  rebuy_cost,
  addon_price,
  buy_in_chips,
  rebuy1_chips,
  rebuy2_chips,
  addon_chips,
  bonus_chips,
  addon_enabled,
  rebuy_chips,
  participation_points,
  prize_pool_percent,
  bonus_enabled
)
select
  '00000000-0000-4000-8000-000000000002',
  g.name,
  g.buy_in,
  g.blind_structure,
  g.prize_rules,
  g.game_kind,
  g.rebuy_cost,
  g.addon_price,
  g.buy_in_chips,
  g.rebuy1_chips,
  g.rebuy2_chips,
  g.addon_chips,
  g.bonus_chips,
  g.addon_enabled,
  g.rebuy_chips,
  g.participation_points,
  g.prize_pool_percent,
  g.bonus_enabled
from public.game_presets g
where g.venue_id = '00000000-0000-4000-8000-000000000001'
  and not exists (
    select 1 from public.game_presets x
    where x.venue_id = '00000000-0000-4000-8000-000000000002' and x.name = g.name
  );

do $$
declare
  yeoksam uuid := '00000000-0000-4000-8000-000000000001';
  misa uuid := '00000000-0000-4000-8000-000000000002';
begin
  create temporary table if not exists _bs_map (
    old_id uuid primary key,
    new_id uuid not null
  ) on commit drop;

  insert into _bs_map (old_id, new_id)
  select b.id, gen_random_uuid()
  from public.blind_structures b
  where b.venue_id = yeoksam
    and not exists (
      select 1 from public.blind_structures x
      where x.venue_id = misa and x.template_name = b.template_name
    )
  on conflict do nothing;

  insert into public.blind_structures (id, venue_id, template_name, default_buy_in)
  select m.new_id, misa, b.template_name, b.default_buy_in
  from public.blind_structures b
  join _bs_map m on m.old_id = b.id;

  insert into public.blind_levels (
    structure_id, level_number, level_kind, small_blind, big_blind, ante, duration_minutes
  )
  select
    m.new_id,
    l.level_number,
    l.level_kind,
    l.small_blind,
    l.big_blind,
    l.ante,
    l.duration_minutes
  from public.blind_levels l
  join _bs_map m on m.old_id = l.structure_id
  on conflict (structure_id, level_number) do nothing;
end $$;
