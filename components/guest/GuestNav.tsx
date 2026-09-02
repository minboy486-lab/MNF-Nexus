"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/guest", label: "홈", icon: "home", match: "exact" as const },
  { href: "/guest/points", label: "포인트", icon: "account_balance_wallet", match: "prefix" as const },
  {
    href: "/guest/scores",
    label: "이벤트",
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
    <nav className="guest-nav" aria-label="손님 메뉴">
      <div className="guest-nav__inner">
        {tabs.map((tab) => {
          const active = isActive(pathname, tab.href, tab.match);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`guest-nav-item ${active ? "guest-nav-item--active" : ""}`}
            >
              <span className="material-symbols-outlined guest-nav-item__icon">{tab.icon}</span>
              <span className="guest-nav-item__label">{tab.label}</span>
              {active && <span className="guest-nav-indicator" aria-hidden />}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
