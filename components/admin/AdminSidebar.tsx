"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/lib/actions/auth";

const links = [
  { href: "/admin/dashboard", label: "대시보드", icon: "dashboard" },
  { href: "/counter", label: "접수대", icon: "dialpad" },
  { href: "/admin/tables", label: "전체 테이블", icon: "grid_view" },
  { href: "/admin/guests", label: "손님 관리", icon: "groups" },
  { href: "/admin/presets", label: "게임 프리셋", icon: "tune" },
  { href: "/admin/games/new", label: "게임 개설", icon: "add_circle" },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="glass-sidebar hidden md:flex w-64 flex-col py-6 relative z-10">
      <div className="px-6 mb-10">
        <p className="text-lg font-bold tracking-tight bg-gradient-to-br from-primary to-secondary bg-clip-text text-transparent">
          MNF HOLDEM
        </p>
        <p className="text-on-surface-variant/80 text-[11px] mt-1.5 uppercase tracking-[0.2em] font-medium">
          Nexus Console
        </p>
      </div>
      <nav className="flex-1 px-3 space-y-1">
        {links.map((link) => {
          const active =
            pathname === link.href ||
            (link.href !== "/admin/dashboard" && pathname.startsWith(link.href));
          return (
            <Link
              key={link.href}
              href={link.href}
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
      <div className="px-3 pt-4 mt-auto border-t border-white/10">
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
    </aside>
  );
}
