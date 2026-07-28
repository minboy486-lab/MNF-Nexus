-- 손님 공개 랭킹: 닉네임 목록만 노출 (phone·password 등 제외)

create or replace view public.ranking_members_public as
select id, venue_id, nickname
from public.members;

grant select on public.ranking_members_public to anon, authenticated;
