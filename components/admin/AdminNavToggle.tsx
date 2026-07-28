"use client";

import { useAdminNav } from "@/components/admin/AdminNavContext";

type Props = {
  className?: string;
};

export function AdminNavToggle({
  className = "shrink-0 p-2 -ml-1 rounded-lg border border-white/10 bg-surface-container-low/60 hover:bg-white/10 text-on-surface transition-colors",
}: Props) {
  const { navOpen, openNav } = useAdminNav();

  if (navOpen) return null;

  return (
    <button
      type="button"
      onClick={openNav}
      className={className}
      aria-label="메뉴 열기"
      aria-expanded={false}
    >
      <span className="material-symbols-outlined text-2xl">menu</span>
    </button>
  );
}
