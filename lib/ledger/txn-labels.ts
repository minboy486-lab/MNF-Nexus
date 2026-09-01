const LABELS: Record<string, string> = {
  buy_in: "바이인",
  rebuy: "리바인",
  prize_payout: "프라이즈",
  cash_in: "현금 입금",
  card_in: "카드 입금",
  transfer_in: "계좌 입금",
  point_spend: "포인트 사용",
  point_earn: "포인트 충전",
  credit_charge: "결제할 금액 등록",
  credit_collect: "결제할 금액 회수",
  refund: "환불",
};

export function txnTypeLabel(txnType: string): string {
  return LABELS[txnType] ?? txnType;
}

/** 내역 표시용 부호 (원 단위). */
export function signedTxnAmount(txnType: string, amount: number): number {
  const n = Number(amount);
  if (!Number.isFinite(n)) return 0;
  switch (txnType) {
    case "point_spend":
    case "buy_in":
    case "rebuy":
    case "credit_charge":
      return -Math.abs(n);
    case "point_earn":
    case "prize_payout":
    case "cash_in":
    case "card_in":
    case "transfer_in":
    case "credit_collect":
    case "refund":
      return Math.abs(n);
    default:
      return n;
  }
}
