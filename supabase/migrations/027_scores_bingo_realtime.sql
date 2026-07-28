-- 승점·빙고·하이핸드 공개 페이지 실시간 동기화

do $$
declare
  t text;
begin
  foreach t in array array[
    'public.bingo_month_settings',
    'public.bingo_marks',
    'public.high_hand_daily',
    'public.manual_score_daily'
  ]
  loop
    begin
      execute format('alter publication supabase_realtime add table %s', t);
    exception
      when duplicate_object then null;
      when others then
        if sqlerrm like '%already member of publication%' then
          null;
        else
          raise;
        end if;
    end;
  end loop;
end $$;
