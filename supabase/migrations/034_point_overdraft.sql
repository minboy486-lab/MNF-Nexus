-- MP 차감 시 잔액 초과 허용: 초과분은 credit_balance(미수)로 전환

create or replace function public.adjust_member_points(
  p_member_id uuid,
  p_delta bigint,
  p_note text default null,
  p_created_by uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member public.members%rowtype;
  v_new_point bigint;
  v_new_credit bigint;
  v_overflow bigint;
  v_txn_type text;
  v_amount bigint;
  v_txn_id uuid;
begin
  if not public.is_admin() then
    raise exception '관리자만 포인트를 조정할 수 있습니다.';
  end if;

  if p_delta is null or p_delta = 0 then
    raise exception '조정 금액을 입력하세요.';
  end if;

  select * into v_member
  from public.members
  where id = p_member_id
  for update;

  if not found then
    raise exception '손님을 찾을 수 없습니다.';
  end if;

  v_new_point := coalesce(v_member.point_balance, 0) + p_delta;
  v_new_credit := coalesce(v_member.credit_balance, 0);

  if v_new_point < 0 then
    v_overflow := abs(v_new_point);
    v_new_point := 0;
    v_new_credit := v_new_credit - v_overflow;
  end if;

  if p_delta > 0 then
    v_txn_type := 'point_earn';
    v_amount := p_delta;
  else
    v_txn_type := 'point_spend';
    v_amount := abs(p_delta);
  end if;

  update public.members
  set
    point_balance = v_new_point,
    credit_balance = v_new_credit
  where id = p_member_id;

  insert into public.money_transactions (
    venue_id,
    member_id,
    txn_type,
    amount,
    payment_method,
    note,
    created_by
  ) values (
    v_member.venue_id,
    p_member_id,
    v_txn_type,
    v_amount,
    'points',
    nullif(trim(p_note), ''),
    p_created_by
  )
  returning id into v_txn_id;

  return jsonb_build_object(
    'ok', true,
    'member_id', p_member_id,
    'point_balance', v_new_point,
    'credit_balance', v_new_credit,
    'delta', p_delta,
    'transaction_id', v_txn_id
  );
end;
$$;
