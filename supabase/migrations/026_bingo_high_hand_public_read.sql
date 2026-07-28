-- 공개 랭킹 페이지용 빙고·하이핸드 anon 읽기

drop policy if exists bingo_month_settings_public_select on public.bingo_month_settings;
create policy bingo_month_settings_public_select on public.bingo_month_settings
  for select to anon using (true);

drop policy if exists bingo_marks_public_select on public.bingo_marks;
create policy bingo_marks_public_select on public.bingo_marks
  for select to anon using (true);

drop policy if exists high_hand_daily_public_select on public.high_hand_daily;
create policy high_hand_daily_public_select on public.high_hand_daily
  for select to anon using (true);
