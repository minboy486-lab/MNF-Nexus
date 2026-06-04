-- Run after 001_initial.sql and 002_platform.sql

insert into public.venues (id, name, timezone)
values (
  '00000000-0000-4000-8000-000000000001',
  'MNF HOLDEM',
  'Asia/Seoul'
)
on conflict (id) do nothing;

update public.physical_tables
set venue_id = '00000000-0000-4000-8000-000000000001',
    sort_order = case code
      when 'A' then 1 when 'B' then 2 when 'C' then 3 when 'D' then 4 else 0 end
where venue_id is null;

insert into public.physical_tables (venue_id, code, label, is_active, sort_order)
select
  '00000000-0000-4000-8000-000000000001',
  v.code,
  v.label,
  true,
  v.ord
from (values
  ('A', 'Table A', 1),
  ('B', 'Table B', 2),
  ('C', 'Table C', 3),
  ('D', 'Table D', 4)
) as v(code, label, ord)
where not exists (
  select 1 from public.physical_tables t
  where t.venue_id = '00000000-0000-4000-8000-000000000001' and t.code = v.code
);

insert into public.expense_categories (venue_id, code, label) values
  ('00000000-0000-4000-8000-000000000001', 'rent', '월세'),
  ('00000000-0000-4000-8000-000000000001', 'utilities', '관리비'),
  ('00000000-0000-4000-8000-000000000001', 'drinks', '음료(캔)'),
  ('00000000-0000-4000-8000-000000000001', 'supplies', '쿠팡/비품'),
  ('00000000-0000-4000-8000-000000000001', 'payroll', '급여'),
  ('00000000-0000-4000-8000-000000000001', 'other', '기타')
on conflict (venue_id, code) do nothing;

-- Blind maps from legacy presets (if game_presets still has rows)
insert into public.blind_structures (id, venue_id, template_name, default_buy_in)
select
  gen_random_uuid(),
  '00000000-0000-4000-8000-000000000001',
  p.name,
  p.buy_in
from public.game_presets p
where not exists (
  select 1 from public.blind_structures b
  where b.venue_id = '00000000-0000-4000-8000-000000000001'
    and b.template_name = p.name
);

insert into public.prize_structures (venue_id, name, game_kind, default_payout_places, placements) values
  (
    '00000000-0000-4000-8000-000000000001',
    '데일리 5인 프라이즈',
    'daily',
    5,
    '[{"rank":1,"percent":40},{"rank":2,"percent":25},{"rank":3,"percent":15},{"rank":4,"percent":12},{"rank":5,"percent":8}]'::jsonb
  ),
  (
    '00000000-0000-4000-8000-000000000001',
    'MTT 6인 프라이즈',
    'mtt',
    6,
    '[{"rank":1,"percent":35},{"rank":2,"percent":22},{"rank":3,"percent":15},{"rank":4,"percent":12},{"rank":5,"percent":9},{"rank":6,"percent":7}]'::jsonb
  )
on conflict do nothing;

insert into public.win_point_presets (venue_id, name, placements) values
  (
    '00000000-0000-4000-8000-000000000001',
    '데일리 승점',
    '[{"rank":1,"points":100},{"rank":2,"points":70},{"rank":3,"points":50},{"rank":4,"points":30},{"rank":5,"points":20}]'::jsonb
  )
on conflict do nothing;

insert into public.staff (venue_id, name, role, hourly_wage, pin_hash) values
  ('00000000-0000-4000-8000-000000000001', '딜러 A', 'dealer', 15000, null),
  ('00000000-0000-4000-8000-000000000001', '매니저', 'manager', 20000, null)
on conflict do nothing;

insert into public.kakao_templates (venue_id, kind, body_template) values
  (
    '00000000-0000-4000-8000-000000000001',
    'status',
    '[MNF] {game_name}\n테이블: {table}\nLevel {level} | {blinds}\n생존 {survivors}/{entries}'
  ),
  (
    '00000000-0000-4000-8000-000000000001',
    'money_in',
    '[MNF] 투데이 머니인 {session_date}\n{winners_list}\n합계: {total}'
  )
on conflict do nothing;

-- After creating admin user in Supabase Auth:
-- update public.profiles set role = 'admin', venue_id = '00000000-0000-4000-8000-000000000001' where id = '<your-user-uuid>';

-- 손님 451명 (닉네임 목록, PW 123456): 006 적용 후 seed_members.sql 실행
