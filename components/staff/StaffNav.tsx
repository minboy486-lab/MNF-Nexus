"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [{ href: "/staff/tables", label: "테이블", icon: "grid_view" }] as const;

export function StaffNav() {
  const pathname = usePathname();
  const onTables =
    pathname.startsWith("/staff/tables") || pathname.startsWith("/admin/tables");

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 border-t border-outline-variant/30 bg-surface-container-lowest/95 backdrop-blur-md safe-area-pb">
      <div className="flex justify-center max-w-lg mx-auto">
        {tabs.map((tab) => {
          const active = tab.href === "/staff/tables" ? onTables : pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-col items-center py-2.5 px-8 min-w-[5rem] text-[11px] font-semibold ${
                active ? "text-primary" : "text-on-surface-variant"
              }`}
            >
              <span className="material-symbols-outlined text-2xl">{tab.icon}</span>
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
