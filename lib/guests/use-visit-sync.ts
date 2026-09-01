"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";

/** 방문·손님 목록 변경 시 SSR 페이지를 갱신 (웹 방문/포인트 관리) */
export function useVisitSync(venueId: string) {
  const router = useRouter();

  useEffect(() => {
    let debounceId: number | undefined;

    function scheduleRefresh() {
      if (debounceId !== undefined) window.clearTimeout(debounceId);
      debounceId = window.setTimeout(() => router.refresh(), 300);
    }

    if (!venueId) {
      const pollId = window.setInterval(scheduleRefresh, 15_000);
      return () => {
        window.clearInterval(pollId);
        if (debounceId !== undefined) window.clearTimeout(debounceId);
      };
    }

    if (!isSupabaseConfigured()) {
      const pollId = window.setInterval(scheduleRefresh, 15_000);
      return () => {
        window.clearInterval(pollId);
        if (debounceId !== undefined) window.clearTimeout(debounceId);
      };
    }

    const supabase = createClient();
    const channel = supabase.channel(`admin-visits-${venueId}`);

    const tables = ["member_visits", "members"] as const;
    for (const table of tables) {
      channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table,
          filter: `venue_id=eq.${venueId}`,
        },
        scheduleRefresh,
      );
    }

    channel.subscribe();

    const pollId = window.setInterval(scheduleRefresh, 15_000);

    return () => {
      window.clearInterval(pollId);
      if (debounceId !== undefined) window.clearTimeout(debounceId);
      void supabase.removeChannel(channel);
    };
  }, [venueId, router]);
}
