"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Game } from "@/lib/types";

type Props = {
  games: Game[];
};

function isLive(status: string) {
  return status === "running" || status === "registration_closed";
}

export function LiveGamesTabs({ games }: Props) {
  const pathname = usePathname();
  const live = games.filter((g) => isLive(g.status));

  if (live.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 mb-6">
      <span className="text-xs text-on-surface-variant self-center mr-1">진행 게임</span>
      {live.map((g) => {
        const href = `/admin/games/${g.id}`;
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={g.id}
            href={href}
            className={`px-4 py-2 rounded-full text-sm font-bold border transition-colors ${
              active
                ? "bg-primary/20 border-primary text-primary"
                : "border-white/10 text-on-surface-variant hover:border-primary/40"
            }`}
          >
            #{g.daily_game_number ?? "?"}
            {g.mode === "multi_table" && " · MTT"}
          </Link>
        );
      })}
    </div>
  );
}
