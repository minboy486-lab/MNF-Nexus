  -- 017 미적용 환경에서도 동작하도록 last_payment_method 포함
  alter table public.seats
    add column if not exists last_payment_method text check (
      last_payment_method is null
      or last_payment_method in ('cash', 'card', 'transfer', 'points', 'credit')
    );

  alter table public.seats
    add column if not exists first_payment_method text check (
      first_payment_method is null
      or first_payment_method in ('cash', 'card', 'transfer', 'points', 'credit')
    );

  comment on column public.seats.last_payment_method is '최근 바이인/리바인 결제 방식';
  comment on column public.seats.first_payment_method is '착석 시 최초 바이인 결제 방식 (좌석 표시용, 리바인 시 유지)';

  update public.seats
  set first_payment_method = last_payment_method
  where member_id is not null
    and first_payment_method is null
    and last_payment_method is not null;
