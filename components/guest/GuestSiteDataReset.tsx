"use client";

import { useState } from "react";
import { clearGuestSiteData } from "@/lib/guest/clear-site-data";

export function GuestSiteDataReset() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClear() {
    const confirmed = window.confirm(
      "이 기기에 저장된 로그인, 알림 구독, 캐시를 모두 지웁니다.\n\n다시 로그인해야 합니다. 계속할까요?",
    );
    if (!confirmed) return;

    setError(null);
    setPending(true);
    try {
      await clearGuestSiteData();
    } catch (err) {
      const message = err instanceof Error ? err.message : "데이터 삭제에 실패했습니다.";
      setError(
        message.includes("clear_my_push_subscriptions") || message.includes("function")
          ? "서버 구독 삭제 기능이 아직 없습니다. Supabase에 038_clear_my_push_subscriptions.sql 마이그레이션을 적용해 주세요."
          : message || "데이터 삭제에 실패했습니다. 페이지를 새로고침한 뒤 다시 시도해 주세요.",
      );
      setPending(false);
    }
  }

  return (
    <section className="glass-panel rounded-2xl p-5 border border-white/10 space-y-3">
      <div>
        <h2 className="text-base font-bold">앱 데이터 초기화</h2>
        <p className="text-sm text-on-surface-variant mt-1 leading-relaxed">
          푸시 구독·캐시·저장된 설정을 지우고 로그아웃합니다. 알림이 이상할 때 VAPID 키를
          바꾼 뒤 다시 켜기 전에 사용하세요.
        </p>
      </div>

      <p className="text-xs text-on-surface-variant leading-relaxed">
        iOS 알림 권한(허용/차단)은 여기서 지워지지 않습니다. 필요하면 설정 → 알림에서
        변경해 주세요.
      </p>

      {error && <p className="text-sm text-error">{error}</p>}

      <button
        type="button"
        disabled={pending}
        onClick={() => void handleClear()}
        className="w-full py-2.5 rounded-xl text-sm font-semibold border border-error/30 text-error hover:bg-error/10 transition-colors disabled:opacity-50"
      >
        {pending ? "삭제 중…" : "이 기기의 앱 데이터 삭제"}
      </button>
    </section>
  );
}
