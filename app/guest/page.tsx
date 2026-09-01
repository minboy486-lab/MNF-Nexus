import Link from "next/link";
import { GuestLinkPhone } from "@/components/guest/GuestLinkPhone";
import { GuestVenueEmpty } from "@/components/guest/GuestShell";
import {
  getGuestMember,
  getGuestPendingRequests,
  getGuestVenueContext,
  getGuestWinPointsTotal,
  getOpenVenueSessionForGuest,
} from "@/lib/data/guest-queries";
import { venueById } from "@/lib/venue/constants";
import { formatDisplayPointBalance, formatPaymentDue } from "@/lib/utils/payment-due";

export const dynamic = "force-dynamic";

export default async function GuestHomePage() {
  const ctx = await getGuestVenueContext();
  if (!ctx.userId || ctx.venueIds.length === 0) {
    return <GuestLinkPhone />;
  }

  const member = await getGuestMember();
  const venue = venueById(ctx.venueId ?? "");
  if (!member) {
    return <GuestVenueEmpty venueName={venue?.name ?? "이 지점"} />;
  }

  const [winPoints, pending, session] = await Promise.all([
    getGuestWinPointsTotal(member.id),
    getGuestPendingRequests(member.id),
    ctx.venueId ? getOpenVenueSessionForGuest(ctx.venueId) : Promise.resolve(null),
  ]);

  const paymentDue = formatPaymentDue(member.credit_balance, member.point_balance);

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
            {venue && (
              <p className="text-[11px] text-primary/80 mt-1 font-semibold">{venue.name}</p>
            )}
          </div>
          <Link href="/guest/settings" className="guest-settings-btn shrink-0" aria-label="계정설정">
            <span className="material-symbols-outlined">manage_accounts</span>
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-5 relative z-[1]">
          <div className="rounded-xl bg-white/[0.04] border border-white/10 px-3 py-3">
            <p className="text-[11px] text-on-surface-variant">포인트</p>
            <p className="text-xl font-bold text-primary tabular-nums mt-0.5">
              {formatDisplayPointBalance(member.point_balance, member.credit_balance)}
            </p>
          </div>
          <div className="rounded-xl bg-white/[0.04] border border-white/10 px-3 py-3">
            <p className="text-[11px] text-on-surface-variant">승점</p>
            <p className="text-xl font-bold tabular-nums mt-0.5">
              {winPoints.toLocaleString()}
              <span className="text-sm font-semibold text-on-surface-variant ml-0.5">점</span>
            </p>
          </div>
        </div>

        {paymentDue && (
          <p className="text-error text-sm mt-4 font-semibold relative z-[1]">
            결제할 금액 {paymentDue}
          </p>
        )}
      </section>

      <div
        className={`guest-status-pill ${session ? "guest-status-pill--open" : "guest-status-pill--closed"}`}
      >
        <span
          className={`inline-block w-1.5 h-1.5 rounded-full ${session ? "bg-emerald-400" : "bg-on-surface-variant/50"}`}
          aria-hidden
        />
        {session ? `${venue?.shortName ?? "매장"} 영업 중` : "영업 준비 중"}
      </div>

      {pending.length > 0 && (
        <section className="glass-panel rounded-xl px-4 py-3 border border-primary/25 flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-primary">대기 중 요청</p>
          <span className="text-xs font-bold bg-primary/15 text-primary px-2 py-1 rounded-full tabular-nums">
            {pending.length}건
          </span>
        </section>
      )}

      <nav className="guest-menu-list" aria-label="바로가기">
        <Link href="/guest/points" className="guest-menu-row">
          <span className="guest-menu-row__icon guest-menu-row__icon--primary">
            <span className="material-symbols-outlined">account_balance_wallet</span>
          </span>
          <span className="guest-menu-row__body">
            <span className="guest-menu-row__title">포인트 내역</span>
            <span className="guest-menu-row__sub">MP · 결제</span>
          </span>
          <span className="material-symbols-outlined guest-menu-row__chevron">chevron_right</span>
        </Link>
        <Link href="/guest/scores" className="guest-menu-row">
          <span className="guest-menu-row__icon guest-menu-row__icon--secondary">
            <span className="material-symbols-outlined">emoji_events</span>
          </span>
          <span className="guest-menu-row__body">
            <span className="guest-menu-row__title">승점 · 이벤트</span>
            <span className="guest-menu-row__sub">빙고 · 하이핸드</span>
          </span>
          <span className="material-symbols-outlined guest-menu-row__chevron">chevron_right</span>
        </Link>
      </nav>
    </div>
  );
}
