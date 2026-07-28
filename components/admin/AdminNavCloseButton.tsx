"use client";

import { useAdminNav } from "@/components/admin/AdminNavContext";

type Props = {
  className?: string;
};

export function AdminNavCloseButton({
  className = "p-2 rounded-lg border border-white/10 bg-surface-container-low/60 hover:bg-white/10 text-on-surface-variant hover:text-on-surface transition-colors",
}: Props) {
  const { closeNav } = useAdminNav();

  return (
    <button
      type="button"
      onClick={closeNav}
      className={className}
      aria-label="메뉴 닫기"
    >
      <span className="material-symbols-outlined text-2xl leading-none">chevron_left</span>
    </button>
  );
}
