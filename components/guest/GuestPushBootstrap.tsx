"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { registerServiceWorker, showPointNotification } from "@/lib/guest/push-client";

const POINT_TXN_TYPES = new Set(["point_earn", "point_spend"]);

type Props = {
  memberId: string | null;
};

/** 손님 앱: SW 등록 + 포인트 거래 Realtime 알림 (앱 열림·알림 허용 시). */
export function GuestPushBootstrap({ memberId }: Props) {
  useEffect(() => {
    void registerServiceWorker();
  }, []);

  useEffect(() => {
    if (!memberId || !isSupabaseConfigured()) return;
    if (!("Notification" in window) || Notification.permission !== "granted") return;

    const supabase = createClient();
    const channel = supabase
      .channel(`guest-point-${memberId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "money_transactions",
          filter: `member_id=eq.${memberId}`,
        },
        (payload) => {
          const row = payload.new as {
            txn_type?: string;
            amount?: number;
            note?: string | null;
          };
          if (!row.txn_type || !POINT_TXN_TYPES.has(row.txn_type)) return;
          void showPointNotification({
            txnType: row.txn_type,
            amountWon: Number(row.amount ?? 0),
            note: row.note,
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [memberId]);

  return null;
}
