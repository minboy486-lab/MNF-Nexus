-- endpoint 전역 유니크 + 계정 전환 시 RLS upsert 실패 방지

create or replace function public.upsert_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text
)
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

  if nullif(trim(p_endpoint), '') is null
     or nullif(trim(p_p256dh), '') is null
     or nullif(trim(p_auth), '') is null then
    raise exception '구독 정보가 올바르지 않습니다.';
  end if;

  delete from public.push_subscriptions
  where endpoint = trim(p_endpoint);

  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth)
  values (v_uid, trim(p_endpoint), trim(p_p256dh), trim(p_auth));
end;
$$;

revoke all on function public.upsert_push_subscription(text, text, text) from public;
grant execute on function public.upsert_push_subscription(text, text, text) to authenticated;
