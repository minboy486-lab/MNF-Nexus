import Link from "next/link";
import { GuestLinkPhone } from "@/components/guest/GuestLinkPhone";
import {
  getGuestMember,
  getGuestPendingRequests,
  getGuestWinPointsTotal,
} from "@/lib/data/guest-queries";
import { getOpenVenueSession } from "@/lib/data/queries";
import { formatMp } from "@/lib/utils/mp";
import { formatPaymentDue } from "@/lib/utils/payment-due";

export const dynamic = "force-dynamic";

export default async function GuestHomePage() {
  const member = await getGuestMember();

  if (!member) {
    return <GuestLinkPhone />;
  }

  const [winPoints, pending, session] = await Promise.all([
    getGuestWinPointsTotal(member.id),
    getGuestPendingRequests(member.id),
    getOpenVenueSession(),
  ]);

  const paymentDue = formatPaymentDue(member.credit_balance);

  return (
    <div className="space-y-5">
      <section className="guest-hero-card glass-panel rounded-2xl p-5 border border-primary/20">
        <div className="flex items-start justify-between gap-3 relative z-[1]">
          <div className="min-w-0">
            <p className="text-xs text-on-surface-variant uppercase tracking-wider">Welcome</p>
            <p className="text-2xl font-bold mt-1 truncate">{member.nickname}</p>
            {member.display_name && member.display_name !== member.nickname && (
              <p className="text-sm text-on-surface-variant mt-0.5 truncate">{member.display_name}</p>
            )}
          </div>
          <Link href="/guest/settings" className="guest-settings-link shrink-0">
            <span className="material-symbols-outlined text-base">manage_accounts</span>
            계정설정
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-5 relative z-[1]">
          <div className="rounded-xl bg-white/[0.04] border border-white/10 px-3 py-3">
            <p className="text-[11px] text-on-surface-variant">포인트</p>
            <p className="text-xl font-bold text-primary tabular-nums mt-0.5">
              {formatMp(member.point_balance)}
            </p>
          </div>
          <div className="rounded-xl bg-white/[0.04] border border-white/10 px-3 py-3">
            <p className="text-[11px] text-on-surface-variant">승점</p>
            <p className="text-xl font-bold tabular-nums mt-0.5">
              {winPoints.toLocaleString()}
              <span className="text-sm font-semibold text-on-surface-variant ml-0.5">p</span>
            </p>
          </div>
        </div>

        {paymentDue && (
          <p className="text-error text-sm mt-4 font-semibold relative z-[1]">
            결제할 금액 {paymentDue}
          </p>
        )}
      </section>

      <div className="flex items-center gap-2 text-sm">
        <span
          className={`inline-block w-2 h-2 rounded-full ${session ? "bg-emerald-400" : "bg-on-surface-variant/40"}`}
          aria-hidden
        />
        <span className={session ? "text-emerald-400/90" : "text-on-surface-variant"}>
          {session ? "영업 중" : "영업 준비 중"}
        </span>
      </div>

      {pending.length > 0 && (
        <section className="glass-panel rounded-xl px-4 py-3 border border-primary/25 flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-primary">대기 중 요청</p>
          <span className="text-xs font-bold bg-primary/15 text-primary px-2 py-1 rounded-full tabular-nums">
            {pending.length}건
          </span>
        </section>
      )}

      <section className="grid grid-cols-2 gap-3">
        <Link
          href="/guest/points"
          className="glass-panel rounded-xl p-4 border border-white/10 hover:border-primary/30 transition-colors"
        >
          <span className="material-symbols-outlined text-primary text-2xl">account_balance_wallet</span>
          <p className="font-bold text-sm mt-2">포인트 내역</p>
          <p className="text-[11px] text-on-surface-variant mt-1">MP · 결제</p>
        </Link>
        <Link
          href="/guest/scores"
          className="glass-panel rounded-xl p-4 border border-white/10 hover:border-primary/30 transition-colors"
        >
          <span className="material-symbols-outlined text-secondary text-2xl">emoji_events</span>
          <p className="font-bold text-sm mt-2">승점 · 이벤트</p>
          <p className="text-[11px] text-on-surface-variant mt-1">빙고 · 하이핸드</p>
        </Link>
      </section>
    </div>
  );
}
