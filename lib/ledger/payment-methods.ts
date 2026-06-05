import type { PaymentMethod } from "@/lib/actions/ledger";

export const PAYMENT_METHOD_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: "credit", label: "후불" },
  { value: "cash", label: "현금" },
  { value: "card", label: "카드" },
  { value: "transfer", label: "계좌" },
  { value: "points", label: "포인트" },
];

export function getPaymentMethodLabel(method: PaymentMethod | null | undefined): string {
  if (!method) return "—";
  return PAYMENT_METHOD_OPTIONS.find((o) => o.value === method)?.label ?? method;
}

export function seatBuyInCount(seat: {
  buy_in_count?: number | null;
  rebuy_count?: number | null;
  member_id?: string | null;
}): number {
  if (seat.buy_in_count != null && seat.buy_in_count > 0) return seat.buy_in_count;
  if (seat.member_id) return 1 + (seat.rebuy_count ?? 0);
  return 0;
}
