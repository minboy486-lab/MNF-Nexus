import { formatMp } from "@/lib/utils/mp";

/** credit_balance < 0 인 미수·후불 금액 (양수 MP 문자열). */
export function formatPaymentDue(creditBalance: number): string | null {
  if (creditBalance >= 0) return null;
  return formatMp(Math.abs(creditBalance));
}
