import { GuestLinkPhone } from "@/components/guest/GuestLinkPhone";
import { getGuestMember, getGuestPointHistory } from "@/lib/data/guest-queries";
import { formatMp } from "@/lib/utils/mp";

export const dynamic = "force-dynamic";

export default async function GuestPointsPage() {
  const member = await getGuestMember();
  if (!member) return <GuestLinkPhone />;

  const history = await getGuestPointHistory(member.id);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">포인트</h1>
      <p className="text-3xl font-bold text-primary">{formatMp(member.point_balance)}</p>

      <h2 className="font-bold text-sm text-on-surface-variant mt-6">최근 내역</h2>
      <ul className="space-y-2">
        {history.map((row: { id: string; txn_type: string; amount: number; occurred_at: string }) => (
          <li
            key={row.id}
            className="glass-panel rounded-lg px-4 py-3 flex justify-between text-sm"
          >
            <span>{row.txn_type}</span>
            <span className={row.amount >= 0 ? "text-primary" : "text-error"}>
              {row.amount >= 0 ? "+" : ""}
              {formatMp(row.amount)}
            </span>
          </li>
        ))}
        {history.length === 0 && (
          <p className="text-on-surface-variant text-sm">내역이 없습니다.</p>
        )}
      </ul>
    </div>
  );
}
