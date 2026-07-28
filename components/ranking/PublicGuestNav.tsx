"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/ranking", label: "랭킹", icon: "emoji_events" },
  { href: "/ranking/bingo", label: "빙고", icon: "grid_view" },
  { href: "/ranking/highhand", label: "하이핸드", icon: "style" },
];

export function PublicGuestNav() {
  const pathname = usePathname();

  return (
    <nav className="public-guest-nav fixed bottom-0 inset-x-0 z-50 border-t border-white/10 bg-surface-container-lowest/95 backdrop-blur-md safe-area-pb">
      <div className="flex justify-around max-w-lg mx-auto">
        {tabs.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`public-guest-nav-item flex flex-col items-center py-2.5 px-3 min-w-[72px] text-[10px] font-semibold transition-colors ${
                active ? "text-primary" : "text-on-surface-variant"
              }`}
            >
              <span
                className={`material-symbols-outlined text-[1.65rem] mb-0.5 ${
                  active ? "public-guest-nav-icon-active" : ""
                }`}
              >
                {tab.icon}
              </span>
              {tab.label}
              {active && <span className="public-guest-nav-indicator" aria-hidden />}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
