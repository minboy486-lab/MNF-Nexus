-- 앱 데이터 초기화 시 본인 푸시 구독 전부 삭제 (RLS 우회, upsert RPC와 동일 패턴)

create or replace function public.clear_my_push_subscriptions()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception '로그인이 필요합니다.';
  end if;

  delete from public.push_subscriptions where user_id = v_uid;
end;
$$;

revoke all on function public.clear_my_push_subscriptions() from public;
grant execute on function public.clear_my_push_subscriptions() to authenticated;
