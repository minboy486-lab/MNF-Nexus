-- 프로필 권한: 관리자·매니저·직원·손님·스크린 (기존 counter → screen)

update public.profiles set role = 'screen' where role = 'counter';

alter table public.profiles drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('admin', 'manager', 'staff', 'guest', 'screen'));

create or replace function public.is_staff_or_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('admin', 'manager', 'staff', 'screen')
  );
$$;

create or replace function public.is_manager_or_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('admin', 'manager')
  );
$$;

create or replace function public.is_screen_role()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('screen', 'counter')
  );
$$;

-- counter 별칭 유지(미적용 DB 호환)
create or replace function public.is_counter_desk()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_screen_role();
$$;
