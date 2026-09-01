"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/guest", label: "홈", icon: "home" },
  { href: "/guest/points", label: "포인트", icon: "account_balance_wallet" },
  { href: "/guest/games", label: "게임", icon: "casino" },
  { href: "/guest/reserve", label: "예약", icon: "event" },
  { href: "/guest/transfer", label: "이체", icon: "swap_horiz" },
  { href: "/guest/settings", label: "설정", icon: "settings" },
];

export function GuestNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 border-t border-outline-variant/30 bg-surface-container-lowest safe-area-pb">
      <div className="flex justify-around max-w-lg mx-auto">
        {tabs.map((tab) => {
          const active =
            pathname === tab.href ||
            (tab.href !== "/guest" && pathname.startsWith(`${tab.href}/`));
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-col items-center py-2 px-2 min-w-[56px] text-[10px] ${
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
