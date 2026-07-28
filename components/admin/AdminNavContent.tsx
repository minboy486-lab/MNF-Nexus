"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { signOut } from "@/lib/actions/auth";
import { AdminNavAccountLink } from "@/components/admin/AdminNavAccountLink";
import { AdminNavCloseButton } from "@/components/admin/AdminNavCloseButton";

type NavChild = {
  href: string;
  label: string;
  icon: string;
  match?: "exact" | "prefix";
};

type NavGroup = {
  id: string;
  label: string;
  icon: string;
  basePath: string;
  children: NavChild[];
};

type NavLink = {
  href: string;
  label: string;
  icon: string;
  external?: boolean;
};

const scoresGroup: NavGroup = {
  id: "scores",
  label: "승점 및 출석",
  icon: "emoji_events",
  basePath: "/admin/scores",
  children: [
    { href: "/admin/scores", label: "게임·순위·출석", icon: "edit_note", match: "exact" },
    { href: "/admin/scores/bingo", label: "빙고", icon: "grid_view" },
    { href: "/admin/scores/highhand", label: "하이핸드", icon: "style" },
  ],
};

const topLinks: NavLink[] = [
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

function isChildActive(pathname: string, child: NavChild): boolean {
  if (child.match === "exact") return pathname === child.href;
  return pathname === child.href || pathname.startsWith(`${child.href}/`);
}

function isGroupActive(pathname: string, group: NavGroup): boolean {
  return pathname === group.basePath || pathname.startsWith(`${group.basePath}/`);
}

function NavItem({
  href,
  label,
  icon,
  active,
  external,
  onNavigate,
  indent,
}: {
  href: string;
  label: string;
  icon: string;
  active: boolean;
  external?: boolean;
  onNavigate?: () => void;
  indent?: boolean;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      className={`flex items-center gap-3 rounded-xl text-sm font-medium transition-all duration-200 ${
        indent ? "pl-9 pr-4 py-2.5" : "px-4 py-3"
      } ${
        active
          ? "bg-primary/15 text-primary border border-primary/25 shadow-[0_0_20px_rgba(255,22,240,0.12)]"
          : "text-on-surface-variant hover:bg-white/5 hover:text-on-surface border border-transparent"
      }`}
    >
      <span className={`material-symbols-outlined text-xl ${active ? "text-primary" : ""}`}>
        {icon}
      </span>
      {label}
    </Link>
  );
}

function NavGroupBlock({
  group,
  pathname,
  open,
  onToggle,
  onNavigate,
}: {
  group: NavGroup;
  pathname: string;
  open: boolean;
  onToggle: () => void;
  onNavigate?: () => void;
}) {
  const groupActive = isGroupActive(pathname, group);

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={onToggle}
        className={`flex w-full items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
          groupActive
            ? "bg-primary/10 text-primary border border-primary/20"
            : "text-on-surface-variant hover:bg-white/5 hover:text-on-surface border border-transparent"
        }`}
        aria-expanded={open}
      >
        <span className={`material-symbols-outlined text-xl ${groupActive ? "text-primary" : ""}`}>
          {group.icon}
        </span>
        <span className="flex-1 text-left">{group.label}</span>
        <span
          className={`material-symbols-outlined text-lg transition-transform ${open ? "rotate-180" : ""}`}
        >
          expand_more
        </span>
      </button>
      {open && (
        <div className="space-y-0.5">
          {group.children.map((child) => (
            <NavItem
              key={child.href}
              href={child.href}
              label={child.label}
              icon={child.icon}
              active={isChildActive(pathname, child)}
              onNavigate={onNavigate}
              indent
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function AdminNavContent({ onNavigate, showAccountLink = false }: Props) {
  const pathname = usePathname();
  const [scoresOpen, setScoresOpen] = useState(() => isGroupActive(pathname, scoresGroup));

  useEffect(() => {
    if (isGroupActive(pathname, scoresGroup)) {
      setScoresOpen(true);
    }
  }, [pathname]);

  return (
    <>
      <div className="admin-sidebar-head">
        <Link
          href="/admin/dashboard"
          onClick={onNavigate}
          className="admin-sidebar-brand rounded-xl hover:bg-white/5 transition-colors"
          aria-label="대시보드로 이동"
        >
          <p className="text-xl font-bold tracking-tight bg-gradient-to-br from-primary to-secondary bg-clip-text text-transparent">
            MNF HOLDEM
          </p>
          <p className="text-on-surface-variant/80 text-xs mt-1.5 uppercase tracking-[0.25em] font-medium">
            NEXUS
          </p>
        </Link>
        <AdminNavCloseButton className="admin-sidebar-close shrink-0" />
      </div>
      <nav className="flex-1 px-3 space-y-1 overflow-y-auto min-h-0">
        <NavGroupBlock
          group={scoresGroup}
          pathname={pathname}
          open={scoresOpen}
          onToggle={() => setScoresOpen((v) => !v)}
          onNavigate={onNavigate}
        />
        {topLinks.map((link) => {
          const active =
            pathname === link.href ||
            (link.href !== "/admin/dashboard" && pathname.startsWith(link.href));
          return (
            <NavItem
              key={link.href}
              href={link.href}
              label={link.label}
              icon={link.icon}
              active={active}
              external={link.external}
              onNavigate={onNavigate}
            />
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
