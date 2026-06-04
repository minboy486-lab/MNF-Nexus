"use client";

import { AdminNavProvider } from "@/components/admin/AdminNavContext";
import { AdminSidebar } from "@/components/admin/AdminSidebar";

export function AdminShell({
  children,
  showAccountLink,
}: {
  children: React.ReactNode;
  showAccountLink?: boolean;
}) {
  return (
    <AdminNavProvider>
      <div className="admin-shell flex h-dvh overflow-hidden">
        <div className="bg-mesh" aria-hidden />
        <AdminSidebar showAccountLink={showAccountLink} />
        <div className="admin-main flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
          {children}
        </div>
      </div>
    </AdminNavProvider>
  );
}
