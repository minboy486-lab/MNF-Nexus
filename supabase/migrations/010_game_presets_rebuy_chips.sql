alter table public.game_presets
  add column if not exists rebuy_chips jsonb not null default '[{"order":1,"chips":0}]'::jsonb;

comment on column public.game_presets.rebuy_chips is
  '[{"order":1,"chips":30000},{"order":2,"chips":30000},...]';

update public.game_presets
set rebuy_chips = case
  when coalesce(rebuy2_chips, 0) > 0 then
    jsonb_build_array(
      jsonb_build_object('order', 1, 'chips', coalesce(rebuy1_chips, 0)),
      jsonb_build_object('order', 2, 'chips', rebuy2_chips)
    )
  else
    jsonb_build_array(
      jsonb_build_object('order', 1, 'chips', coalesce(rebuy1_chips, 0))
    )
end;
