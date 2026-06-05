alter table public.seats
  add column if not exists buy_in_count integer not null default 0;

create table if not exists public.game_member_buy_ins (
  game_id uuid not null references public.games (id) on delete cascade,
  member_id uuid not null references public.members (id) on delete cascade,
  buy_in_count integer not null default 0,
  primary key (game_id, member_id)
);

comment on column public.seats.buy_in_count is '해당 좌석 플레이어의 게임 내 누적 바인 횟수 (리바인·재바인 포함)';
comment on table public.game_member_buy_ins is '게임별 회원 누적 바인 횟수 (싯아웃 후 재바인 누적)';

update public.seats
set buy_in_count = 1 + coalesce(rebuy_count, 0)
where member_id is not null;

insert into public.game_member_buy_ins (game_id, member_id, buy_in_count)
select game_id, member_id, buy_in_count
from public.seats
where member_id is not null and buy_in_count > 0
on conflict (game_id, member_id) do update
set buy_in_count = greatest(game_member_buy_ins.buy_in_count, excluded.buy_in_count);
