-- 블라인드(game_presets) 생성·수정·삭제: 관리자 + 매니저

drop policy if exists presets_admin on public.game_presets;
create policy presets_admin on public.game_presets
  for all
  using (public.is_manager_or_admin())
  with check (public.is_manager_or_admin());
