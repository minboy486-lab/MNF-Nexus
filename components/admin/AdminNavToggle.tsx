"use client";

import { useAdminNav } from "@/components/admin/AdminNavContext";

type Props = {
  className?: string;
};

export function AdminNavToggle({
  className = "shrink-0 p-2 -ml-1 rounded-lg border border-white/10 bg-surface-container-low/60 hover:bg-white/10 text-on-surface transition-colors",
}: Props) {
  const { navOpen, toggleNav } = useAdminNav();

  return (
    <button
      type="button"
      onClick={toggleNav}
      className={className}
      aria-label={navOpen ? "메뉴 닫기" : "메뉴 열기"}
      aria-expanded={navOpen}
    >
      <span className="material-symbols-outlined text-2xl">
        {navOpen ? "close" : "menu"}
      </span>
    </button>
  );
}
