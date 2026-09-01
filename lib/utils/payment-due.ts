import { formatMp } from "@/lib/utils/mp";

/** DB 원 단위 credit_balance에서 결제할 금액(양수 원). */
export function rawPaymentDueWon(creditBalance: number): number {
  if (creditBalance >= 0) return 0;
  return Math.abs(creditBalance);
}

/** 포인트 잔액으로 결제할 금액을 상쇄한 표시용 잔액·미수. */
export function resolveMemberBalances(pointBalanceWon: number, creditBalanceWon: number) {
  const dueWon = rawPaymentDueWon(creditBalanceWon);
  const offsetWon = Math.min(pointBalanceWon, dueWon);
  return {
    pointBalanceWon: pointBalanceWon - offsetWon,
    paymentDueWon: dueWon - offsetWon,
  };
}

/** 상쇄 반영 후 결제할 금액 문자열. 없으면 null. */
export function formatPaymentDue(creditBalance: number, pointBalance?: number): string | null {
  const dueWon =
    pointBalance !== undefined
      ? resolveMemberBalances(pointBalance, creditBalance).paymentDueWon
      : rawPaymentDueWon(creditBalance);
  if (dueWon <= 0) return null;
  return formatMp(dueWon);
}

/** 상쇄 반영 후 포인트 잔액 문자열. */
export function formatDisplayPointBalance(pointBalance: number, creditBalance: number): string {
  return formatMp(resolveMemberBalances(pointBalance, creditBalance).pointBalanceWon);
}
