import { GuestLinkPhone } from "@/components/guest/GuestLinkPhone";
import { getGuestMember, getGuestPointHistory } from "@/lib/data/guest-queries";
import { signedTxnAmount, txnTypeLabel } from "@/lib/ledger/txn-labels";
import { formatMp } from "@/lib/utils/mp";
import { formatPaymentDue } from "@/lib/utils/payment-due";

export const dynamic = "force-dynamic";

export default async function GuestPointsPage() {
  const member = await getGuestMember();
  if (!member) return <GuestLinkPhone />;

  const history = await getGuestPointHistory(member.id);
  const paymentDue = formatPaymentDue(member.credit_balance);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">포인트</h1>
      <p className="text-3xl font-bold text-primary">{formatMp(member.point_balance)}</p>
      {paymentDue && (
        <p className="text-error text-sm font-semibold">결제할 금액: {paymentDue}</p>
      )}

      <h2 className="font-bold text-sm text-on-surface-variant mt-6">최근 내역</h2>
      <ul className="space-y-2">
        {history.map((row: {
          id: string;
          txn_type: string;
          amount: number;
          note: string | null;
          occurred_at: string;
        }) => {
          const signed = signedTxnAmount(row.txn_type, row.amount);
          return (
            <li
              key={row.id}
              className="glass-panel rounded-lg px-4 py-3 flex justify-between gap-3 text-sm"
            >
              <div className="min-w-0">
                <span>{txnTypeLabel(row.txn_type)}</span>
                {row.note && (
                  <p className="text-xs text-on-surface-variant mt-0.5 truncate">{row.note}</p>
                )}
              </div>
              <span className={`shrink-0 tabular-nums ${signed >= 0 ? "text-primary" : "text-error"}`}>
                {signed >= 0 ? "+" : ""}
                {formatMp(signed)}
              </span>
            </li>
          );
        })}
        {history.length === 0 && (
          <p className="text-on-surface-variant text-sm">내역이 없습니다.</p>
        )}
      </ul>
    </div>
  );
}
