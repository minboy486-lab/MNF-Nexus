"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { StaffBackLink } from "@/components/staff/StaffBackLink";
import { StaffNav } from "@/components/staff/StaffNav";
import { VenueSwitcher } from "@/components/venue/VenueSwitcher";
import { signOut } from "@/lib/actions/auth";

export function StaffShell({
  children,
  working,
}: {
  children: React.ReactNode;
  working: boolean;
}) {
  const pathname = usePathname();
  const isHome = pathname === "/staff";
  const hideNav = pathname.startsWith("/staff/clock-in") || pathname.startsWith("/staff/timer");

  return (
    <div className="min-h-dvh bg-surface flex flex-col staff-shell">
      <header className="staff-shell__header sticky top-0 z-40 border-b border-outline-variant/30 bg-surface/95 backdrop-blur-md px-4 flex justify-between items-center shrink-0">
        {hideNav ? (
          isHome ? (
            <Link href="/staff" className="font-bold text-primary leading-none py-1">
              MNF · 직원
            </Link>
          ) : (
            <StaffBackLink />
          )
        ) : (
          <div className="flex items-center gap-3 min-w-0">
            {isHome ? (
              <Link href="/staff" className="font-bold text-primary leading-none py-1 shrink-0">
                MNF · 직원
              </Link>
            ) : (
              <StaffBackLink />
            )}
            <VenueSwitcher compact />
          </div>
        )}
        {!working && (
          <form action={signOut}>
            <button
              type="submit"
              className="h-9 px-3.5 rounded-lg text-xs font-semibold border border-white/20 bg-white/10 text-on-surface shadow-sm active:scale-[0.94] active:bg-white/20 transition-transform"
            >
              로그아웃
            </button>
          </form>
        )}
      </header>
      <main className={`flex-1 min-h-0 ${hideNav ? "" : "pb-20"}`}>{children}</main>
      <StaffNav />
    </div>
  );
}
