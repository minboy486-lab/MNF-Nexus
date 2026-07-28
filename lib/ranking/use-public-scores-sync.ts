"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { DEFAULT_VENUE_ID } from "@/lib/venue/constants";

export type PublicScoresSyncScope = "bingo" | "highhand" | "ranking";

const TABLES_BY_SCOPE: Record<PublicScoresSyncScope, string[]> = {
  bingo: ["bingo_marks", "bingo_month_settings"],
  highhand: ["high_hand_daily"],
  ranking: ["manual_score_daily"],
};

/** 관리자 승점·빙고·하이핸드 변경을 공개 페이지에 실시간 반영 */
export function usePublicScoresSync(scope: PublicScoresSyncScope) {
  const router = useRouter();
  const scopeRef = useRef(scope);
  scopeRef.current = scope;

  useEffect(() => {
    let debounceId: number | undefined;

    function scheduleRefresh() {
      if (debounceId !== undefined) window.clearTimeout(debounceId);
      debounceId = window.setTimeout(() => router.refresh(), 250);
    }

    if (!isSupabaseConfigured()) {
      const pollId = window.setInterval(scheduleRefresh, 30_000);
      return () => {
        window.clearInterval(pollId);
        if (debounceId !== undefined) window.clearTimeout(debounceId);
      };
    }

    const supabase = createClient();
    const tables = TABLES_BY_SCOPE[scopeRef.current];
    const channel = supabase.channel(`public-scores-${scopeRef.current}`);

    for (const table of tables) {
      channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table,
          filter: `venue_id=eq.${DEFAULT_VENUE_ID}`,
        },
        scheduleRefresh,
      );
    }

    channel.subscribe();

    // Realtime(anon RLS·publication) 실패 시 폴링 백업
    const pollId = window.setInterval(scheduleRefresh, 15_000);

    return () => {
      window.clearInterval(pollId);
      if (debounceId !== undefined) window.clearTimeout(debounceId);
      void supabase.removeChannel(channel);
    };
  }, [router, scope]);
}
