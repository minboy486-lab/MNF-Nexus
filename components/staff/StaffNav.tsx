"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/staff", label: "홈", icon: "home", match: (p: string) => p === "/staff" },
  { href: "/staff/attendance", label: "근무 기록", icon: "history", match: (p: string) => p.startsWith("/staff/attendance") },
] as const;

export function StaffNav() {
  const pathname = usePathname();
  if (pathname.startsWith("/staff/clock-in") || pathname.startsWith("/staff/timer")) {
    return null;
  }

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 border-t border-outline-variant/30 bg-surface-container-lowest/95 backdrop-blur-md safe-area-pb">
      <div className="flex justify-center max-w-lg mx-auto">
        {tabs.map((tab) => {
          const active = tab.match(pathname);
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
