"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type Props = {
  show: boolean;
  onNavigate?: () => void;
};

/** 권한 링크는 마운트 후 표시 — 서버/클라이언트 세션 불일치 하이드레이션 방지 */
export function AdminNavAccountLink({ show, onNavigate }: Props) {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(show);
  }, [show]);

  if (!visible) return null;

  const active = pathname.startsWith("/admin/accounts");

  return (
    <Link
      href="/admin/accounts"
      onClick={onNavigate}
      className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
        active
          ? "bg-primary/15 text-primary border border-primary/25"
          : "text-on-surface-variant hover:bg-white/5 hover:text-on-surface border border-transparent"
      }`}
    >
      <span className="material-symbols-outlined text-xl">manage_accounts</span>
      계정 관리
    </Link>
  );
}
