-- 손님 공개 랭킹 페이지용 (로그인 없이 조회)

drop policy if exists manual_score_daily_public_select on public.manual_score_daily;
create policy manual_score_daily_public_select on public.manual_score_daily
  for select to anon using (true);
