"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo } from "react";
import { PublicGuestHeader } from "@/components/ranking/PublicGuestHeader";
import { HIGH_HAND_TYPES, type HighHandEntry } from "@/lib/events/types";
import { useGuestNickname } from "@/lib/ranking/use-guest-nickname";
import { usePublicScoresSync } from "@/lib/ranking/use-public-scores-sync";
import { isVenueOperatingToday } from "@/lib/venue/operating-date";
import { useVenueOperatingDateRollover } from "@/lib/venue/use-operating-date-rollover";

type Props = {
  playDate: string;
  hasDateInUrl: boolean;
  entries: HighHandEntry[];
};

function formatDateKo(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${Number(y)}년 ${Number(m)}월 ${Number(d)}일`;
}

export function PublicHighHandClient({ playDate, hasDateInUrl, entries }: Props) {
  const router = useRouter();
  const { nickname, showNicknameModal, saveNickname, openEdit, closeEdit } =
    useGuestNickname();

  const handleOperatingRollover = useCallback(() => {
    router.replace("/ranking/highhand");
    router.refresh();
  }, [router]);

  useVenueOperatingDateRollover(playDate, hasDateInUrl, handleOperatingRollover);
  usePublicScoresSync("highhand");

  const rows = useMemo(
    () =>
      HIGH_HAND_TYPES.map((hand) => {
        const entry = entries.find((e) => e.hand_type === hand.id);
        return { hand, entry };
      }),
    [entries],
  );

  const myHands = useMemo(() => {
    if (!nickname) return [];
    const q = nickname.trim().toLowerCase();
    return rows.filter((r) => r.entry?.nickname.toLowerCase() === q).map((r) => r.hand.label);
  }, [rows, nickname]);

  return (
    <div className="public-ranking-page">
      <PublicGuestHeader
        nickname={nickname}
        showNicknameModal={showNicknameModal}
        onSaveNickname={saveNickname}
        onOpenEdit={openEdit}
        onCloseEdit={closeEdit}
      />

      <div className="public-ranking-hero">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-[1.75rem] font-black tracking-tight">하이핸드</h1>
          {isVenueOperatingToday(playDate) && (
            <span className="public-rank-badge public-rank-badge-top text-[10px] px-2 py-0.5">
              TODAY
            </span>
          )}
        </div>
        <p className="text-sm text-on-surface-variant mt-1">{formatDateKo(playDate)}</p>
      </div>

      {nickname && myHands.length > 0 && (
        <section className="public-ranking-my-card public-ranking-my-card-found mb-4">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-xs font-bold text-primary">내 기록</span>
            <span className="public-rank-badge-me">ME</span>
          </div>
          <p className="text-sm">
            <span className="font-bold">{nickname}</span>
            <span className="text-on-surface-variant"> · </span>
            <span className="text-primary font-semibold">{myHands.join(", ")}</span>
          </p>
        </section>
      )}

      <ul className="space-y-2">
        {rows.map(({ hand, entry }) => {
          const isMine =
            nickname &&
            entry?.nickname.toLowerCase() === nickname.trim().toLowerCase();

          return (
            <li
              key={hand.id}
              className={`glass-panel rounded-2xl px-4 py-3.5 flex items-center justify-between gap-3 ${
                isMine ? "public-highhand-row-mine" : ""
              }`}
            >
              <div className="min-w-0">
                <p className="font-bold">{hand.label}</p>
                <p className="text-xs text-on-surface-variant mt-0.5">{hand.mp}MP</p>
              </div>
              {entry ? (
                <div className="text-right shrink-0">
                  <p className="font-bold text-primary">{entry.nickname}</p>
                  {isMine && (
                    <span className="public-rank-badge-me text-[9px] mt-1 inline-block">ME</span>
                  )}
                </div>
              ) : (
                <span className="text-xs text-on-surface-variant/70 px-2.5 py-1 rounded-full border border-white/10 shrink-0">
                  미등록
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
