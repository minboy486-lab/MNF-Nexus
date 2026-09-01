"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/guest", label: "홈", icon: "home", match: "exact" as const },
  { href: "/guest/points", label: "포인트", icon: "account_balance_wallet", match: "prefix" as const },
  {
    href: "/guest/scores",
    label: "승점·이벤트",
    icon: "emoji_events",
    match: "prefix" as const,
  },
];

function isActive(pathname: string, href: string, match: "exact" | "prefix") {
  if (match === "exact") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function GuestNav() {
  const pathname = usePathname();

  return (
    <nav className="guest-nav fixed bottom-0 inset-x-0 z-50 border-t border-white/10 bg-surface-container-lowest/95 backdrop-blur-md">
      <div className="flex justify-around max-w-lg mx-auto">
        {tabs.map((tab) => {
          const active = isActive(pathname, tab.href, tab.match);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`guest-nav-item flex flex-col items-center py-2.5 px-4 min-w-[5.5rem] text-[10px] font-semibold transition-colors ${
                active ? "text-primary" : "text-on-surface-variant"
              }`}
            >
              <span
                className={`material-symbols-outlined text-[1.65rem] mb-0.5 ${
                  active ? "guest-nav-icon-active" : ""
                }`}
              >
                {tab.icon}
              </span>
              {tab.label}
              {active && <span className="guest-nav-indicator" aria-hidden />}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
