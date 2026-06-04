"use client";

import { isSupabaseConfigured } from "@/lib/supabase/env";
import { LiveBadge } from "@/components/admin/LiveBadge";
import { useAdminNav } from "@/components/admin/AdminNavContext";

type Props = {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
};

export function AdminTopBar({ title, subtitle, children }: Props) {
  const { openMobileNav } = useAdminNav();

  return (
    <header className="glass-header shrink-0 z-30 flex items-center gap-3 px-4 py-4 sm:px-6">
      <button
        type="button"
        onClick={openMobileNav}
        className="md:hidden shrink-0 p-2 -ml-1 rounded-lg border border-white/10 bg-surface-container-low/60 hover:bg-white/10 text-on-surface transition-colors"
        aria-label="메뉴 열기"
      >
        <span className="material-symbols-outlined text-2xl">menu</span>
      </button>
      <div className="flex-1 min-w-0">
        <h1 className="text-lg sm:text-xl font-bold tracking-tight bg-gradient-to-r from-primary via-white to-secondary bg-clip-text text-transparent truncate">
          {title}
        </h1>
        {subtitle && (
          <p className="text-on-surface-variant/90 text-xs sm:text-sm mt-0.5 sm:mt-1 font-medium truncate">
            {subtitle}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {!isSupabaseConfigured() && (
          <span className="hidden sm:inline text-xs px-2 sm:px-3 py-1.5 rounded-full bg-white/5 border border-tertiary/30 text-tertiary backdrop-blur-md">
            데모 모드
          </span>
        )}
        <LiveBadge />
        {children}
      </div>
    </header>
  );
}
