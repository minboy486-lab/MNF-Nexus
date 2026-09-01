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
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold">포인트</h1>
        <p className="text-sm text-on-surface-variant mt-1">MP 잔액 및 이용 내역</p>
      </div>

      <section className="glass-panel rounded-2xl p-5 border border-primary/20">
        <p className="text-xs text-on-surface-variant">보유 포인트</p>
        <p className="text-3xl font-bold text-primary tabular-nums mt-1">
          {formatMp(member.point_balance)}
        </p>
        {paymentDue && (
          <p className="text-error text-sm font-semibold mt-3">결제할 금액 {paymentDue}</p>
        )}
      </section>

      <section>
        <h2 className="font-bold text-sm mb-3">최근 내역</h2>
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
                className="glass-panel rounded-xl px-4 py-3 flex justify-between gap-3 text-sm border border-white/5"
              >
                <div className="min-w-0">
                  <span className="font-medium">{txnTypeLabel(row.txn_type)}</span>
                  {row.note && (
                    <p className="text-xs text-on-surface-variant mt-0.5 truncate">{row.note}</p>
                  )}
                </div>
                <span
                  className={`shrink-0 tabular-nums font-semibold ${signed >= 0 ? "text-primary" : "text-error"}`}
                >
                  {signed >= 0 ? "+" : ""}
                  {formatMp(signed)}
                </span>
              </li>
            );
          })}
          {history.length === 0 && (
            <p className="text-on-surface-variant text-sm text-center py-8">내역이 없습니다.</p>
          )}
        </ul>
      </section>
    </div>
  );
}
