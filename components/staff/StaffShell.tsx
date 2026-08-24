"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { StaffNav } from "@/components/staff/StaffNav";
import { signOut } from "@/lib/actions/auth";

export function StaffShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideNav = pathname.startsWith("/staff/clock-in") || pathname.startsWith("/staff/timer");

  return (
    <div className="min-h-dvh bg-surface flex flex-col">
      <header className="sticky top-0 z-40 border-b border-outline-variant/30 bg-surface/95 backdrop-blur-md px-4 py-3 flex justify-between items-center shrink-0">
        <Link href="/staff" className="font-bold text-primary">
          MNF · 직원
        </Link>
        <form action={signOut}>
          <button
            type="submit"
            className="text-xs text-on-surface-variant hover:text-primary transition-colors"
          >
            로그아웃
          </button>
        </form>
      </header>
      <main className={`flex-1 min-h-0 ${hideNav ? "" : "pb-20"}`}>{children}</main>
      <StaffNav />
    </div>
  );
}
