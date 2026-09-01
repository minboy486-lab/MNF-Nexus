"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { syncExistingPushSubscriptionToServer } from "@/lib/guest/enable-push";
import {
  getServiceWorkerRegistration,
  showPointNotification,
} from "@/lib/guest/push-client";

const POINT_TXN_TYPES = new Set(["point_earn", "point_spend"]);

type Props = {
  memberId: string | null;
};

/** 손님 앱: SW 등록 + 포인트 거래 Realtime 알림 + Web Push 구독 유지. */
export function GuestPushBootstrap({ memberId }: Props) {
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;

  useEffect(() => {
    void (async () => {
      await getServiceWorkerRegistration();
      await syncExistingPushSubscriptionToServer();
    })();
  }, []);

  useEffect(() => {
    if (!memberId || !isSupabaseConfigured()) return;

    const supabase = createClient();
    let channel: RealtimeChannel | null = null;
    let reconnectTimer: number | undefined;
    let disposed = false;

    function handlePointInsert(payload: { new: Record<string, unknown> }) {
      const row = payload.new as {
        id?: string;
        member_id?: string;
        txn_type?: string;
        amount?: number;
        note?: string | null;
      };
      if (row.member_id !== memberId) return;
      if (!row.txn_type || !POINT_TXN_TYPES.has(row.txn_type)) return;

      if (Notification.permission === "granted") {
        void showPointNotification({
          txnType: row.txn_type,
          amountWon: Number(row.amount ?? 0),
          note: row.note,
          txnId: row.id,
        });
      }
      routerRef.current.refresh();
    }

    function connect() {
      if (disposed) return;
      if (channel) {
        void supabase.removeChannel(channel);
        channel = null;
      }

      channel = supabase
        .channel(`guest-point-${memberId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "money_transactions",
          },
          handlePointInsert,
        )
        .subscribe((status) => {
          if (disposed) return;
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            reconnectTimer = window.setTimeout(connect, 2000);
          }
        });
    }

    function onVisible() {
      if (document.visibilityState !== "visible") return;
      void syncExistingPushSubscriptionToServer();
      routerRef.current.refresh();
      if (!channel || channel.state !== "joined") {
        connect();
      }
    }

    connect();
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", onVisible);
      if (reconnectTimer !== undefined) window.clearTimeout(reconnectTimer);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [memberId]);

  return null;
}
