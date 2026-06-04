-- 직원·관리자 로그인 아이디 (Supabase Auth 내부 이메일과 분리)

alter table public.profiles
  add column if not exists login_id text;

create unique index if not exists profiles_login_id_uidx
  on public.profiles (login_id)
  where login_id is not null;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, role, display_name, login_id)
  values (
    new.id,
    'guest',
    coalesce(new.raw_user_meta_data->>'display_name', new.email),
    nullif(new.raw_user_meta_data->>'login_id', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
