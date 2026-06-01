"use client";

import { useRouter } from "next/navigation";
import { openVenueSession, closeVenueSession } from "@/lib/actions/venue";
import type { VenueSession } from "@/lib/types";

type Props = {
  session: VenueSession | null;
};

export function SessionBanner({ session }: Props) {
  const router = useRouter();

  async function handleOpen() {
    const res = await openVenueSession();
    if (res.error) alert(res.error);
    router.refresh();
  }

  async function handleClose() {
    if (!confirm("영업을 마감하시겠습니까?")) return;
    const res = await closeVenueSession();
    if (res.error) alert(res.error);
    router.refresh();
  }

  if (!session) {
    return (
      <div className="glass-panel rounded-2xl border-amber-400/30 px-5 py-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-amber-100/90 font-medium">
          영업이 열려 있지 않습니다. 방문·게임 운영 전 「영업 시작」을 눌러 주세요.
        </p>
        <button
          type="button"
          onClick={handleOpen}
          className="bg-gradient-to-r from-primary to-primary-container text-on-primary font-bold px-5 py-2.5 rounded-xl text-sm shadow-[0_0_20px_rgba(255,22,240,0.25)] hover:brightness-110 transition-all"
        >
          영업 시작
        </button>
      </div>
    );
  }

  return (
    <div className="glass-panel rounded-2xl border-emerald-400/25 px-5 py-4 flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-emerald-100/90 font-medium flex items-center gap-2">
        <span className="live-dot w-2 h-2 rounded-full bg-emerald-400" />
        영업 중 · {new Date(session.opened_at).toLocaleString("ko-KR")} ~
      </p>
      <button
        type="button"
        onClick={handleClose}
        className="px-5 py-2.5 rounded-xl text-sm font-semibold border border-white/15 bg-white/5 hover:border-error/40 hover:text-error transition-colors"
      >
        영업 마감
      </button>
    </div>
  );
}
