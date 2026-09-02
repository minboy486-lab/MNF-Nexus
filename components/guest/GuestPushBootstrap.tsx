"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { preloadPushEnvironment } from "@/lib/guest/push-prefetch";
import { isWebPushFullyEnabled, syncExistingPushSubscriptionToServer } from "@/lib/guest/enable-push";
import {
  clearSkipPushSyncCookie,
  shouldSkipPushSync,
  unsubscribeAllPushLocally,
} from "@/lib/guest/push-unsubscribe";
import {
  getServiceWorkerRegistration,
  showPointNotification,
} from "@/lib/guest/push-client";

const POINT_TXN_TYPES = new Set(["point_earn", "point_spend"]);
const REFRESH_DELAY_MS = 1500;

type Props = {
  memberId: string | null;
};

/** 손님 앱: SW 등록 + 포인트 Realtime 갱신/알림 + Web Push 구독 유지. */
export function GuestPushBootstrap({ memberId }: Props) {
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;

  const webPushActiveRef = useRef(false);
  const refreshTimerRef = useRef<number | undefined>(undefined);

  function scheduleGuestRefresh() {
    if (refreshTimerRef.current !== undefined) {
      window.clearTimeout(refreshTimerRef.current);
    }
    refreshTimerRef.current = window.setTimeout(() => {
      refreshTimerRef.current = undefined;
      routerRef.current.refresh();
    }, REFRESH_DELAY_MS);
  }

  async function refreshWebPushState() {
    webPushActiveRef.current = await isWebPushFullyEnabled();
  }

  useEffect(() => {
    void (async () => {
      await preloadPushEnvironment();
      if (shouldSkipPushSync()) {
        clearSkipPushSyncCookie();
        await unsubscribeAllPushLocally();
      } else {
        await syncExistingPushSubscriptionToServer();
      }
      await refreshWebPushState();
    })();
  }, []);

  useEffect(() => {
    function onServiceWorkerMessage(event: MessageEvent) {
      const data = event.data as { type?: string; payload?: Record<string, string> } | null;
      if (data?.type !== "mnf-point-push") return;

      scheduleGuestRefresh();

      if (Notification.permission !== "granted") return;
      const payload = data.payload;
      if (!payload?.txnType) return;

      void showPointNotification({
        txnType: payload.txnType,
        amountWon: Number(payload.amountWon ?? 0),
        note: payload.note,
        txnId: payload.txnId,
      });
    }

    navigator.serviceWorker?.addEventListener("message", onServiceWorkerMessage);
    return () => {
      navigator.serviceWorker?.removeEventListener("message", onServiceWorkerMessage);
      if (refreshTimerRef.current !== undefined) {
        window.clearTimeout(refreshTimerRef.current);
      }
    };
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

      scheduleGuestRefresh();

      const isForeground = document.visibilityState === "visible";
      if (
        Notification.permission === "granted" &&
        (isForeground || !webPushActiveRef.current)
      ) {
        void showPointNotification({
          txnType: row.txn_type,
          amountWon: Number(row.amount ?? 0),
          note: row.note,
          txnId: row.id,
        });
      }
    }

    function handleMemberUpdate(payload: { new: Record<string, unknown> }) {
      const row = payload.new as { id?: string };
      if (row.id !== memberId) return;
      scheduleGuestRefresh();
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
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "members",
            filter: `id=eq.${memberId}`,
          },
          handleMemberUpdate,
        )
        .subscribe((status) => {
          if (disposed) return;
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            reconnectTimer = window.setTimeout(connect, 2000);
          }
        });
    }

    async function onVisible() {
      if (document.visibilityState !== "visible") return;
      if (!shouldSkipPushSync()) {
        await syncExistingPushSubscriptionToServer();
      }
      await refreshWebPushState();
      scheduleGuestRefresh();
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
      if (refreshTimerRef.current !== undefined) window.clearTimeout(refreshTimerRef.current);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [memberId]);

  return null;
}
