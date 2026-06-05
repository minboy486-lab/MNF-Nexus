update public.seats s
set
  first_payment_method = sub.payment_method,
  last_payment_method = coalesce(s.last_payment_method, sub.payment_method)
from (
  select distinct on (game_id, member_id)
    game_id,
    member_id,
    payment_method
  from public.money_transactions
  where txn_type = 'buy_in'
    and payment_method is not null
  order by game_id, member_id, occurred_at asc
) sub
where s.game_id = sub.game_id
  and s.member_id = sub.member_id
  and s.member_id is not null
  and s.first_payment_method is null;
