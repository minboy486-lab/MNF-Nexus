import { GuestLinkPhone } from "@/components/guest/GuestLinkPhone";
import { GuestVenueEmpty } from "@/components/guest/GuestShell";
import {
  getGuestMember,
  getGuestPointHistory,
  getGuestVenueContext,
} from "@/lib/data/guest-queries";
import { venueById } from "@/lib/venue/constants";
import { formatDisplayPointBalance, formatPaymentDue } from "@/lib/utils/payment-due";
import { PointHistoryRow } from "@/components/ledger/PointHistoryRow";

export const dynamic = "force-dynamic";

export default async function GuestPointsPage() {
  const ctx = await getGuestVenueContext();
  if (!ctx.userId || ctx.venueIds.length === 0) return <GuestLinkPhone />;

  const member = await getGuestMember();
  const venue = venueById(ctx.venueId ?? "");
  if (!member) return <GuestVenueEmpty venueName={venue?.name ?? "이 지점"} />;

  const history = await getGuestPointHistory(member.id);
  const paymentDue = formatPaymentDue(member.credit_balance, member.point_balance);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold">포인트</h1>
        <p className="text-sm text-on-surface-variant mt-1">
          {venue?.name ?? "매장"} · MP 잔액 및 이용 내역
        </p>
      </div>

      <section className="glass-panel rounded-2xl p-5 border border-primary/20">
        <p className="text-xs text-on-surface-variant">보유 포인트</p>
        <p className="text-3xl font-bold text-primary tabular-nums mt-1">
          {formatDisplayPointBalance(member.point_balance, member.credit_balance)}
        </p>
        {paymentDue && (
          <p className="text-error text-sm font-semibold mt-3">결제할 금액 {paymentDue}</p>
        )}
      </section>

      <section>
        <h2 className="font-bold text-sm mb-3">최근 내역</h2>
        <ul className="space-y-1.5">
          {history.map((row: {
            id: string;
            txn_type: string;
            amount: number;
            note: string | null;
            occurred_at: string;
          }) => (
            <PointHistoryRow
              key={row.id}
              txnType={row.txn_type}
              amount={row.amount}
              occurredAt={row.occurred_at}
              note={row.note}
            />
          ))}
          {history.length === 0 && (
            <p className="text-on-surface-variant text-sm text-center py-8">내역이 없습니다.</p>
          )}
        </ul>
      </section>
    </div>
  );
}
