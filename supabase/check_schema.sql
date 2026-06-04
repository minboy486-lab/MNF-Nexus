-- Supabase SQL Editor에서 실행: 현재 DB 상태 확인

select 'profiles' as item, exists (
  select 1 from pg_tables where schemaname = 'public' and tablename = 'profiles'
) as ok
union all
select 'venue_players', exists (
  select 1 from pg_tables where schemaname = 'public' and tablename = 'venue_players'
)
union all
select 'members', exists (
  select 1 from pg_tables where schemaname = 'public' and tablename = 'members'
)
union all
select 'venues', exists (
  select 1 from pg_tables where schemaname = 'public' and tablename = 'venues'
)
union all
select 'member_visits', exists (
  select 1 from pg_tables where schemaname = 'public' and tablename = 'member_visits'
)
union all
select 'money_transactions', exists (
  select 1 from pg_tables where schemaname = 'public' and tablename = 'money_transactions'
);

-- 마이그레이션 진행도 (true = 이미 적용됨)
select '003 prize_structures' as step, exists (
  select 1 from pg_tables where schemaname = 'public' and tablename = 'prize_structures'
) as ok
union all
select '004 daily_closeout_lines', exists (
  select 1 from pg_tables where schemaname = 'public' and tablename = 'daily_closeout_lines'
)
union all
select '006 login_id on members', exists (
  select 1 from information_schema.columns
  where table_schema = 'public' and table_name = 'members' and column_name = 'login_id'
);

-- members 컬럼 목록 (login_id 있으면 006 완료)
select column_name
from information_schema.columns
where table_schema = 'public' and table_name = 'members'
order by ordinal_position;
