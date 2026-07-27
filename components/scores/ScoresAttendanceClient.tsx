"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ScoreRecordSheet } from "@/components/scores/ScoreRecordSheet";
import type {
  AttendanceRow,
  ManualScoreDaily,
  MemberSuggestion,
  ScoreRankingRow,
} from "@/lib/scores/types";

type Tab = "record" | "ranking" | "attendance";

type Props = {
  members: MemberSuggestion[];
  todayScores: ManualScoreDaily[];
  ranking: ScoreRankingRow[];
  attendance: AttendanceRow[];
  defaultDate: string;
  periodFrom: string;
  periodTo: string;
  hasDateInUrl: boolean;
};

function formatDateKo(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${Number(m)}월 ${Number(d)}일`;
}

export function ScoresAttendanceClient({
  members,
  todayScores,
  ranking,
  attendance,
  defaultDate,
  periodFrom,
  periodTo,
  hasDateInUrl,
}: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("record");
  const [from, setFrom] = useState(periodFrom);
  const [to, setTo] = useState(periodTo);
  const [nicknameQuery, setNicknameQuery] = useState("");

  const nicknameFilter = nicknameQuery.trim().toLowerCase();

  const filteredRanking = useMemo(() => {
    if (!nicknameFilter) return ranking;
    return ranking.filter((row) => row.nickname.toLowerCase().includes(nicknameFilter));
  }, [ranking, nicknameFilter]);

  const filteredAttendance = useMemo(() => {
    if (!nicknameFilter) return attendance;
    return attendance.filter((row) => row.nickname.toLowerCase().includes(nicknameFilter));
  }, [attendance, nicknameFilter]);

  function applyPeriod() {
    router.push(`/admin/scores?from=${from}&to=${to}&date=${defaultDate}`);
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "record", label: "게임 기록" },
    { id: "ranking", label: "승점 순위" },
    { id: "attendance", label: "출석 조회" },
  ];

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-4">
      <div className="flex flex-wrap gap-1.5 shrink-0">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-colors ${
              tab === t.id
                ? "bg-primary/15 text-primary border-primary/40"
                : "border-white/10 text-on-surface-variant hover:bg-white/5"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab !== "record" && (
        <div className="flex flex-wrap items-end gap-3 shrink-0 glass-panel rounded-xl px-4 py-3">
          <label className="text-xs text-on-surface-variant">
            기간
            <div className="flex items-center gap-2 mt-1">
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="login-input text-sm py-1.5"
              />
              <span className="text-on-surface-variant">~</span>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="login-input text-sm py-1.5"
              />
              <button
                type="button"
                onClick={applyPeriod}
                className="px-3 py-1.5 rounded-lg text-sm border border-primary/40 text-primary hover:bg-primary/10"
              >
                적용
              </button>
            </div>
          </label>
          <label className="text-xs text-on-surface-variant">
            닉네임 검색
            <input
              type="search"
              value={nicknameQuery}
              onChange={(e) => setNicknameQuery(e.target.value)}
              placeholder="닉네임 입력"
              className="login-input text-sm py-1.5 mt-1 w-40"
            />
          </label>
        </div>
      )}

      {tab === "record" && (
        <ScoreRecordSheet
          members={members}
          savedRows={todayScores}
          initialDate={defaultDate}
          periodFrom={periodFrom}
          periodTo={periodTo}
          hasDateInUrl={hasDateInUrl}
        />
      )}

      {tab === "ranking" && (
        <section className="glass-panel rounded-xl p-4 flex-1 min-h-0 flex flex-col">
          <h2 className="font-bold text-sm mb-3 shrink-0">
            승점 순위 ({from} ~ {to})
          </h2>
          <div className="flex-1 min-h-0 overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-[#141218]">
                <tr className="text-on-surface-variant border-b border-white/10 text-xs">
                  <th className="text-left py-2 w-12">순위</th>
                  <th className="text-left py-2">닉네임</th>
                  <th className="text-right py-2">총점</th>
                  <th className="text-right py-2">출석일</th>
                </tr>
              </thead>
              <tbody>
                {filteredRanking.map((row, i) => (
                  <tr key={row.nickname} className="border-b border-white/5">
                    <td className="py-2.5 text-on-surface-variant">{i + 1}</td>
                    <td className="py-2.5 font-semibold">{row.nickname}</td>
                    <td className="py-2.5 text-right font-bold text-primary tabular-nums">
                      {row.total_points}
                    </td>
                    <td className="py-2.5 text-right text-on-surface-variant tabular-nums">
                      {row.visit_days}
                    </td>
                  </tr>
                ))}
                {filteredRanking.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-on-surface-variant">
                      {ranking.length === 0
                        ? "기간 내 기록이 없습니다."
                        : "검색 결과가 없습니다."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === "attendance" && (
        <section className="glass-panel rounded-xl p-4 flex-1 min-h-0 flex flex-col">
          <h2 className="font-bold text-sm mb-3 shrink-0">
            출석 조회 ({from} ~ {to})
          </h2>
          <div className="flex-1 min-h-0 overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-[#141218]">
                <tr className="text-on-surface-variant border-b border-white/10 text-xs">
                  <th className="text-left py-2">닉네임</th>
                  <th className="text-right py-2 w-20">방문</th>
                  <th className="text-right py-2 w-20">게임</th>
                  <th className="text-left py-2 pl-4">방문 날짜</th>
                </tr>
              </thead>
              <tbody>
                {filteredAttendance.map((row) => (
                  <tr key={row.nickname} className="border-b border-white/5 align-top">
                    <td className="py-2.5 font-semibold">{row.nickname}</td>
                    <td className="py-2.5 text-right font-bold text-secondary tabular-nums">
                      {row.visit_count}회
                    </td>
                    <td className="py-2.5 text-right font-semibold text-primary tabular-nums">
                      {row.game_count}회
                    </td>
                    <td className="py-2.5 pl-4 text-on-surface-variant text-xs leading-relaxed">
                      {row.visit_dates.map(formatDateKo).join(", ")}
                    </td>
                  </tr>
                ))}
                {filteredAttendance.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-on-surface-variant">
                      {attendance.length === 0
                        ? "기간 내 출석 기록이 없습니다."
                        : "검색 결과가 없습니다."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
