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
  memberNickname?: string;
  embedded?: boolean;
  /** 영업일 자정 넘김 시 이동할 경로 */
  refreshPath?: string;
};

function formatDateKo(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${Number(y)}년 ${Number(m)}월 ${Number(d)}일`;
}

export function PublicHighHandClient({
  playDate,
  hasDateInUrl,
  entries,
  memberNickname,
  embedded = false,
  refreshPath = "/ranking/highhand",
}: Props) {
  const router = useRouter();
  const guestNick = useGuestNickname();
  const nickname = memberNickname ?? guestNick.nickname;
  const showNicknameModal = memberNickname ? false : guestNick.showNicknameModal;
  const saveNickname = guestNick.saveNickname;
  const openEdit = guestNick.openEdit;
  const closeEdit = guestNick.closeEdit;

  const handleOperatingRollover = useCallback(() => {
    router.replace(refreshPath);
    router.refresh();
  }, [router, refreshPath]);

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
    <div className={embedded ? "" : "public-ranking-page"}>
      {!embedded && (
        <PublicGuestHeader
          nickname={nickname}
          showNicknameModal={showNicknameModal}
          onSaveNickname={saveNickname}
          onOpenEdit={openEdit}
          onCloseEdit={closeEdit}
        />
      )}

      {!embedded ? (
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
      ) : (
        <p className="text-sm text-on-surface-variant mb-3">{formatDateKo(playDate)}</p>
      )}

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
