"use client";

import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { AdminNavContent } from "@/components/admin/AdminNavContent";
import { useAdminNav } from "@/components/admin/AdminNavContext";

export function AdminSidebar({ showAccountLink }: { showAccountLink?: boolean }) {
  const { navOpen, closeNav } = useAdminNav();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const mobileDrawer =
    mounted && navOpen
      ? createPortal(
          <div className="fixed inset-0 z-[180] md:hidden" role="dialog" aria-modal="true">
            <button
              type="button"
              className="absolute inset-0 bg-black/80"
              aria-label="메뉴 닫기"
              onClick={closeNav}
            />
            <aside className="glass-sidebar absolute left-0 top-0 bottom-0 w-[min(18rem,88vw)] flex flex-col py-4 shadow-2xl">
              <div className="flex flex-col flex-1 min-h-0">
                <AdminNavContent onNavigate={closeNav} showAccountLink={showAccountLink} />
              </div>
            </aside>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      {navOpen && (
        <aside className="glass-sidebar hidden md:flex w-64 flex-col py-4 relative z-10 shrink-0">
          <div className="flex flex-col flex-1 min-h-0">
            <AdminNavContent showAccountLink={showAccountLink} />
          </div>
        </aside>
      )}
      {mobileDrawer}
    </>
  );
}
