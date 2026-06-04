"use client";

import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { AdminNavContent } from "@/components/admin/AdminNavContent";
import { useAdminNav } from "@/components/admin/AdminNavContext";

export function AdminSidebar({ showAccountLink }: { showAccountLink?: boolean }) {
  const { mobileOpen, closeMobileNav } = useAdminNav();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const mobileDrawer =
    mounted && mobileOpen
      ? createPortal(
          <div className="fixed inset-0 z-[180] md:hidden" role="dialog" aria-modal="true">
            <button
              type="button"
              className="absolute inset-0 bg-black/80"
              aria-label="메뉴 닫기"
              onClick={closeMobileNav}
            />
            <aside className="glass-sidebar absolute left-0 top-0 bottom-0 w-[min(18rem,88vw)] flex flex-col py-5 shadow-2xl">
              <div className="flex items-center justify-end px-3 pb-2 shrink-0">
                <button
                  type="button"
                  onClick={closeMobileNav}
                  className="p-2 rounded-lg hover:bg-white/10 text-on-surface-variant"
                  aria-label="닫기"
                >
                  <span className="material-symbols-outlined text-xl">close</span>
                </button>
              </div>
              <div className="flex flex-col flex-1 min-h-0 -mt-2">
                <AdminNavContent
                  onNavigate={closeMobileNav}
                  showAccountLink={showAccountLink}
                />
              </div>
            </aside>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <aside className="glass-sidebar hidden md:flex w-64 flex-col py-6 relative z-10 shrink-0">
        <AdminNavContent showAccountLink={showAccountLink} />
      </aside>
      {mobileDrawer}
    </>
  );
}
