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

-- 운영 DB가 007~014를 안 탄 경우를 여기서 맞춤 (없는 컬럼만 추가)
alter table public.game_presets
  add column if not exists game_kind text not null default 'daily',
  add column if not exists rebuy_cost integer not null default 0,
  add column if not exists addon_price integer not null default 0,
  add column if not exists buy_in_chips bigint not null default 0,
  add column if not exists rebuy1_chips bigint not null default 0,
  add column if not exists rebuy2_chips bigint not null default 0,
  add column if not exists addon_chips bigint not null default 0,
  add column if not exists bonus_chips bigint not null default 0,
  add column if not exists addon_enabled boolean not null default false,
  add column if not exists rebuy_chips jsonb not null default '[{"order":1,"chips":0}]'::jsonb,
  add column if not exists participation_points integer not null default 0,
  add column if not exists prize_pool_percent integer not null default 100,
  add column if not exists bonus_enabled boolean not null default false;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'game_presets_prize_pool_percent_check'
  ) then
    alter table public.game_presets
      add constraint game_presets_prize_pool_percent_check
      check (prize_pool_percent >= 0 and prize_pool_percent <= 100);
  end if;
end $$;

update public.game_presets
set rebuy_chips = case
  when coalesce(rebuy2_chips, 0) > 0 then
    jsonb_build_array(
      jsonb_build_object('order', 1, 'chips', coalesce(rebuy1_chips, 0)),
      jsonb_build_object('order', 2, 'chips', rebuy2_chips)
    )
  else
    jsonb_build_array(
      jsonb_build_object('order', 1, 'chips', coalesce(rebuy1_chips, 0))
    )
end
where rebuy_chips = '[{"order":1,"chips":0}]'::jsonb
  and (coalesce(rebuy1_chips, 0) > 0 or coalesce(rebuy2_chips, 0) > 0);

update public.game_presets
set bonus_enabled = true
where coalesce(bonus_chips, 0) > 0 and bonus_enabled = false;

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
-- 운영 스키마에 없는 컬럼은 건너뛴다. current_game_id 같은 운영 컬럼은 복사하지 않음.

create or replace function public._028_copy_venue_rows(
  p_table text,
  p_from uuid,
  p_to uuid,
  p_cols text[],
  p_match text
) returns void
language plpgsql as $$
declare
  dest_list text := 'venue_id';
  src_list text := quote_literal(p_to) || '::uuid';
  col text;
  sql text;
begin
  if to_regclass(format('public.%I', p_table)) is null then
    return;
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = p_table and column_name = 'venue_id'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = p_table and column_name = p_match
  ) then
    return;
  end if;

  for col in
    select c.column_name
    from unnest(p_cols) with ordinality as u(col, ord)
    join information_schema.columns c
      on c.table_schema = 'public'
     and c.table_name = p_table
     and c.column_name = u.col
    order by u.ord
  loop
    dest_list := dest_list || ', ' || quote_ident(col);
    src_list := src_list || ', s.' || quote_ident(col);
  end loop;

  sql := format(
    'insert into public.%I (%s)
     select %s
     from public.%I s
     where s.venue_id = %L
       and not exists (
         select 1 from public.%I t
         where t.venue_id = %L and t.%I = s.%I
       )',
    p_table, dest_list, src_list, p_table, p_from, p_table, p_to, p_match, p_match
  );
  execute sql;
end;
$$;

do $$
begin
  perform public._028_copy_venue_rows(
    'physical_tables',
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000002',
    array['code', 'label', 'is_active', 'sort_order', 'layout_image_url'],
    'code'
  );
  perform public._028_copy_venue_rows(
    'expense_categories',
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000002',
    array['code', 'label'],
    'code'
  );
  perform public._028_copy_venue_rows(
    'prize_structures',
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000002',
    array['name', 'game_kind', 'max_entries', 'default_payout_places', 'placements'],
    'name'
  );
  perform public._028_copy_venue_rows(
    'win_point_presets',
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000002',
    array['name', 'placements'],
    'name'
  );
  perform public._028_copy_venue_rows(
    'kakao_templates',
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000002',
    array['kind', 'body_template'],
    'kind'
  );
  perform public._028_copy_venue_rows(
    'game_presets',
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000002',
    array[
      'name',
      'buy_in',
      'blind_structure',
      'prize_rules',
      'game_kind',
      'rebuy_cost',
      'addon_price',
      'buy_in_chips',
      'rebuy1_chips',
      'rebuy2_chips',
      'addon_chips',
      'bonus_chips',
      'addon_enabled',
      'rebuy_chips',
      'participation_points',
      'prize_pool_percent',
      'bonus_enabled'
    ],
    'name'
  );
end $$;

drop function public._028_copy_venue_rows(text, uuid, uuid, text[], text);

do $$
declare
  yeoksam uuid := '00000000-0000-4000-8000-000000000001';
  misa uuid := '00000000-0000-4000-8000-000000000002';
  dest_list text := 'id, venue_id';
  src_list text := 'm.new_id, ' || quote_literal(misa) || '::uuid';
  level_dest text := 'structure_id';
  level_src text := 'm.new_id';
  col text;
begin
  if to_regclass('public.blind_structures') is null
     or to_regclass('public.blind_levels') is null then
    return;
  end if;

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

  for col in
    select c.column_name
    from unnest(array['template_name', 'default_buy_in']) with ordinality as u(col, ord)
    join information_schema.columns c
      on c.table_schema = 'public'
     and c.table_name = 'blind_structures'
     and c.column_name = u.col
    order by u.ord
  loop
    dest_list := dest_list || ', ' || quote_ident(col);
    src_list := src_list || ', b.' || quote_ident(col);
  end loop;

  execute format(
    'insert into public.blind_structures (%s)
     select %s
     from public.blind_structures b
     join _bs_map m on m.old_id = b.id',
    dest_list, src_list
  );

  for col in
    select c.column_name
    from unnest(array[
      'level_number', 'level_kind', 'small_blind', 'big_blind', 'ante', 'duration_minutes'
    ]) with ordinality as u(col, ord)
    join information_schema.columns c
      on c.table_schema = 'public'
     and c.table_name = 'blind_levels'
     and c.column_name = u.col
    order by u.ord
  loop
    level_dest := level_dest || ', ' || quote_ident(col);
    level_src := level_src || ', l.' || quote_ident(col);
  end loop;

  execute format(
    'insert into public.blind_levels (%s)
     select %s
     from public.blind_levels l
     join _bs_map m on m.old_id = l.structure_id
     on conflict (structure_id, level_number) do nothing',
    level_dest, level_src
  );
end $$;
