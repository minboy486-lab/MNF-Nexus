-- 손님 회원: 아이디·비밀번호·닉네임(유니크)·이름·전화
-- 선행: 001_initial.sql 필수. 002_platform.sql 권장(venue_id·visits 등).

do $$
begin
  if to_regclass('public.members') is null and to_regclass('public.venue_players') is not null then
    alter table public.venue_players rename to members;
  end if;
end $$;

do $$
begin
  if to_regclass('public.members') is null then
    raise exception 'public.members 테이블이 없습니다. Supabase SQL Editor에서 001_initial.sql → 002_platform.sql 순서로 먼저 실행하세요.';
  end if;
end $$;

-- 002 미적용 시 venue_id 컬럼만 추가 (venues 테이블은 002에서 생성)
alter table public.members
  add column if not exists venue_id uuid;

alter table public.members
  add column if not exists login_id text;

alter table public.members
  add column if not exists password_hash text;

alter table public.members
  add column if not exists display_name text;

alter table public.members
  add column if not exists phone text;

alter table public.members
  add column if not exists point_balance bigint not null default 0;

alter table public.members
  add column if not exists credit_balance bigint not null default 0;

alter table public.members drop constraint if exists venue_players_floor_status_check;
alter table public.members drop constraint if exists members_floor_status_check;

alter table public.members
  add constraint members_floor_status_check
  check (floor_status in ('registered', 'visitor', 'waiting', 'in_game', 'reserved'));

alter table public.members
  alter column floor_status set default 'registered';

-- 기존 손님 floor_status 정리 (002 적용 후)
do $$
begin
  if to_regclass('public.member_visits') is not null then
    update public.members m
    set floor_status = 'registered'
    where m.floor_status = 'visitor'
      and not exists (
        select 1 from public.member_visits v
        where v.member_id = m.id
          and v.checked_out_at is null
          and v.status = 'on_floor'
      );
  else
    update public.members set floor_status = 'registered' where floor_status = 'visitor';
  end if;
end $$;

create unique index if not exists members_venue_login_uidx
  on public.members (venue_id, login_id)
  where login_id is not null;

create unique index if not exists members_venue_nickname_uidx
  on public.members (venue_id, nickname);

-- venue_id 없을 때 닉네임 전역 유일 (002 전 임시)
create unique index if not exists members_nickname_global_uidx
  on public.members (nickname)
  where venue_id is null;
