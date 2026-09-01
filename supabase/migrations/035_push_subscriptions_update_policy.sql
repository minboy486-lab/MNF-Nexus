-- Web Push 구독 upsert 시 UPDATE 허용 (데드락 방지: 한 문장씩 실행 권장)

drop policy if exists push_subscriptions_update_own on public.push_subscriptions;

create policy push_subscriptions_update_own on public.push_subscriptions
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
