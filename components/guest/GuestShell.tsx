"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GuestVenueSwitcher } from "@/components/guest/GuestVenueSwitcher";
import type { KnownVenue } from "@/lib/venue/constants";
import { GuestNav } from "@/components/guest/GuestNav";
import { GuestPushBootstrap } from "@/components/guest/GuestPushBootstrap";

type Props = {
  venues: KnownVenue[];
  activeVenueId: string;
  memberId?: string | null;
  children: React.ReactNode;
};

export function GuestShell({ venues, activeVenueId, memberId, children }: Props) {
  const pathname = usePathname();
  const hideNav = pathname.startsWith("/guest/settings");

  return (
    <div className="guest-shell-outer">
      <div className="guest-shell">
        <div className="bg-mesh" aria-hidden />
        <header className="guest-shell__header">
          <p className="guest-shell__brand">MNF HOLDEM</p>
          <GuestVenueSwitcher venues={venues} activeVenueId={activeVenueId} />
        </header>
        <main className="guest-shell__main">{children}</main>
        <GuestPushBootstrap memberId={memberId ?? null} />
        {!hideNav && <GuestNav />}
      </div>
    </div>
  );
}

export function GuestVenueEmpty({ venueName }: { venueName: string }) {
  return (
    <div className="glass-panel rounded-2xl p-6 text-center space-y-2 border border-white/10">
      <span className="material-symbols-outlined text-4xl text-on-surface-variant/50">store</span>
      <p className="font-bold">{venueName}에 등록된 정보가 없습니다</p>
      <p className="text-sm text-on-surface-variant leading-relaxed">
        상단에서 다른 지점을 선택하거나, 매장 데스크에서 이 지점 손님 등록을 요청해 주세요.
      </p>
      <Link href="/guest" className="inline-block text-sm text-primary font-semibold mt-2">
        홈으로
      </Link>
    </div>
  );
}
