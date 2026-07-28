"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { clearHighHand, saveHighHand } from "@/lib/actions/high-hand";
import { HIGH_HAND_TYPES, type HighHandEntry, type HighHandType } from "@/lib/events/types";
import type { MemberSuggestion } from "@/lib/scores/types";
import { NicknameAutocomplete } from "@/components/scores/NicknameAutocomplete";
import { isVenueOperatingToday } from "@/lib/venue/operating-date";
import { useVenueOperatingDateRollover } from "@/lib/venue/use-operating-date-rollover";

type Props = {
  playDate: string;
  hasDateInUrl: boolean;
  entries: HighHandEntry[];
  members: MemberSuggestion[];
};

function formatDateKo(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${Number(y)}년 ${Number(m)}월 ${Number(d)}일`;
}

export function HighHandAdminClient({ playDate, hasDateInUrl, entries, members }: Props) {
  const router = useRouter();

  const handleOperatingRollover = useCallback(() => {
    router.replace("/admin/scores/highhand");
    router.refresh();
  }, [router]);

  useVenueOperatingDateRollover(playDate, hasDateInUrl, handleOperatingRollover);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<HighHandType, string>>(() => {
    const initial = {} as Record<HighHandType, string>;
    for (const hand of HIGH_HAND_TYPES) {
      const entry = entries.find((e) => e.hand_type === hand.id);
      initial[hand.id] = entry?.nickname ?? "";
    }
    return initial;
  });

  useEffect(() => {
    const next = {} as Record<HighHandType, string>;
    for (const hand of HIGH_HAND_TYPES) {
      const entry = entries.find((e) => e.hand_type === hand.id);
      next[hand.id] = entry?.nickname ?? "";
    }
    setDrafts(next);
    setError(null);
    setMessage(null);
  }, [playDate, entries]);

  function navigateDate(date: string) {
    router.push(`/admin/scores/highhand?date=${date}`);
  }

  async function handleSave(handType: HighHandType) {
    const nickname = drafts[handType].trim();
    if (!nickname) {
      setError("닉네임을 입력하세요.");
      return;
    }
    setPending(true);
    setError(null);
    const res = await saveHighHand({ playDate, handType, nickname });
    setPending(false);
    if (res && "error" in res && res.error) {
      setError(res.error);
      return;
    }
    setMessage(`${HIGH_HAND_TYPES.find((h) => h.id === handType)?.label} 저장 완료`);
    router.refresh();
  }

  async function handleClear(handType: HighHandType) {
    setPending(true);
    setError(null);
    const res = await clearHighHand(playDate, handType);
    setPending(false);
    if (res && "error" in res && res.error) {
      setError(res.error);
      return;
    }
    setDrafts((prev) => ({ ...prev, [handType]: "" }));
    router.refresh();
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-4">
      <section className="score-record-panel glass-panel rounded-xl flex-1 min-h-0 flex flex-col overflow-hidden">
        <div className="score-list-toolbar shrink-0">
          <div className="score-list-toolbar-field">
            <span className="score-list-toolbar-label">날짜</span>
            <input
              type="date"
              value={playDate}
              onChange={(e) => navigateDate(e.target.value)}
              className="admin-toolbar-input"
              aria-label="하이핸드 날짜"
            />
          </div>
          <span className="score-list-toolbar-meta ml-auto">
            {formatDateKo(playDate)}
            {isVenueOperatingToday(playDate) && !hasDateInUrl && (
              <span className="ml-1.5 text-primary">· 오늘</span>
            )}
          </span>
        </div>

        <div className="score-list-heading shrink-0">
          <h2 className="text-sm font-bold text-on-surface">하이핸드</h2>
          <span className="text-[10px] text-on-surface-variant">일별 3종 · MP 자동 적용</span>
        </div>

        {(error || message) && (
          <div
            className={`shrink-0 px-3 py-1.5 text-[11px] border-b ${
              error
                ? "text-error bg-error/10 border-error/20"
                : "text-primary bg-primary/10 border-primary/20"
            }`}
          >
            {error ?? message}
          </div>
        )}

        <div className="flex-1 min-h-0 overflow-auto score-list-table-wrap">
          <table className="score-list-table w-full text-sm">
            <thead>
              <tr>
                <th className="text-left w-28">핸드</th>
                <th className="text-right w-16">MP</th>
                <th className="text-left">닉네임</th>
                <th className="text-right w-32">처리</th>
              </tr>
            </thead>
            <tbody>
              {HIGH_HAND_TYPES.map((hand) => {
                const saved = entries.find((e) => e.hand_type === hand.id);
                return (
                  <tr key={hand.id}>
                    <td className="font-semibold">{hand.label}</td>
                    <td className="text-right text-primary font-bold tabular-nums">{hand.mp}</td>
                    <td>
                      <NicknameAutocomplete
                        members={members}
                        value={drafts[hand.id]}
                        onChange={(v) => setDrafts((prev) => ({ ...prev, [hand.id]: v }))}
                        disabled={pending}
                        id={`highhand-${hand.id}`}
                      />
                    </td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => void handleSave(hand.id)}
                          className="score-list-toolbar-apply"
                        >
                          저장
                        </button>
                        {saved && (
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => void handleClear(hand.id)}
                            className="px-2 py-1 rounded-md text-xs text-on-surface-variant border border-white/10 hover:bg-white/5"
                          >
                            삭제
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
