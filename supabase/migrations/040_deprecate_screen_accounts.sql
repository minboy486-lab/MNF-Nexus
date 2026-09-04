-- 스크린(screen/counter) 계정 정리 안내
-- 앱에서는 더 이상 스크린 계정을 생성·수정하지 않으며 계정 관리 목록에서도 숨깁니다.
-- /counter · isScreenRole 미들웨어는 기존 로그인 호환을 위해 유지합니다.
--
-- 기존 스크린 계정 확인:
--   select id, login_id, role, display_name
--   from public.profiles
--   where role in ('screen', 'counter');
--
-- Auth 유저까지 삭제하려면 Supabase Dashboard → Authentication → Users
-- 또는 service role로 auth.users 삭제 후 profiles 가 cascade/정리되는지 확인하세요.
-- 역할만 직원으로 바꾸려면:
--   update public.profiles set role = 'staff' where role in ('screen', 'counter');

select count(*) as screen_account_count
from public.profiles
where role in ('screen', 'counter');
