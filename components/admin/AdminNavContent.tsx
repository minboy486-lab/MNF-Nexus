"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/lib/actions/auth";
import { AdminNavAccountLink } from "@/components/admin/AdminNavAccountLink";

const links = [
  { href: "/admin/dashboard", label: "대시보드", icon: "dashboard" },
  { href: "/admin/operations", label: "운영 탭", icon: "schedule" },
  { href: "/admin/tables", label: "전체 테이블", icon: "grid_view" },
  { href: "/admin/guests", label: "손님 관리", icon: "groups" },
  { href: "/admin/presets", label: "블라인드", icon: "tune" },
  { href: "/admin/games/new", label: "게임 개설", icon: "add_circle" },
  { href: "/admin/settlement/daily", label: "일일 정산", icon: "receipt_long" },
  { href: "/admin/settlement/monthly", label: "월간 정산", icon: "calendar_month" },
  { href: "/admin/staff", label: "직원·급여", icon: "badge" },
  { href: "/admin/events", label: "이벤트", icon: "casino" },
  { href: "/tv", label: "TV 타이머", icon: "tv", external: true },
];

type Props = {
  onNavigate?: () => void;
  showAccountLink?: boolean;
};

export function AdminNavContent({ onNavigate, showAccountLink = false }: Props) {
  const pathname = usePathname();

  return (
    <>
      <Link
        href="/admin/dashboard"
        onClick={onNavigate}
        className="block px-6 mb-8 rounded-xl hover:bg-white/5 transition-colors"
        aria-label="대시보드로 이동"
      >
        <p className="text-xl font-bold tracking-tight bg-gradient-to-br from-primary to-secondary bg-clip-text text-transparent">
          MNF HOLDEM
        </p>
        <p className="text-on-surface-variant/80 text-xs mt-1.5 uppercase tracking-[0.25em] font-medium">
          NEXUS
        </p>
      </Link>
      <nav className="flex-1 px-3 space-y-1 overflow-y-auto min-h-0">
        {links.map((link) => {
          const active =
            pathname === link.href ||
            (link.href !== "/admin/dashboard" && pathname.startsWith(link.href));
          const isExternal = "external" in link && link.external;
          return (
            <Link
              key={link.href}
              href={link.href}
              onClick={onNavigate}
              target={isExternal ? "_blank" : undefined}
              rel={isExternal ? "noopener noreferrer" : undefined}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                active
                  ? "bg-primary/15 text-primary border border-primary/25 shadow-[0_0_20px_rgba(255,22,240,0.12)]"
                  : "text-on-surface-variant hover:bg-white/5 hover:text-on-surface border border-transparent"
              }`}
            >
              <span
                className={`material-symbols-outlined text-xl ${active ? "text-primary" : ""}`}
              >
                {link.icon}
              </span>
              {link.label}
            </Link>
          );
        })}
      </nav>
      <div className="px-3 pt-4 mt-auto border-t border-white/10 shrink-0 space-y-1">
        <AdminNavAccountLink show={showAccountLink} onNavigate={onNavigate} />
        <form action={signOut}>
          <button
            type="submit"
            className="flex w-full items-center gap-3 px-4 py-3 rounded-xl text-sm text-on-surface-variant hover:bg-white/5 hover:text-on-surface transition-colors border border-transparent hover:border-white/10"
          >
            <span className="material-symbols-outlined text-xl">logout</span>
            로그아웃
          </button>
        </form>
      </div>
    </>
  );
}
