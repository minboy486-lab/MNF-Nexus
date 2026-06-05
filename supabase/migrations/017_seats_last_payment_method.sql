alter table public.seats
  add column if not exists last_payment_method text check (
    last_payment_method is null
    or last_payment_method in ('cash', 'card', 'transfer', 'points', 'credit')
  );

comment on column public.seats.last_payment_method is '최근 바이인/리바인 결제 방식 (좌석 표시용)';
