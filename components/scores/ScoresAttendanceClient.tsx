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

function ScoresListToolbar({
  from,
  to,
  title,
  countLabel,
  nicknameQuery,
  onFromChange,
  onToChange,
  onApply,
  onNicknameChange,
}: {
  from: string;
  to: string;
  title: string;
  countLabel: string;
  nicknameQuery: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  onApply: () => void;
  onNicknameChange: (value: string) => void;
}) {
  return (
    <>
      <div className="score-list-toolbar shrink-0">
        <div className="score-list-toolbar-field">
          <span className="score-list-toolbar-label">기간</span>
          <input
            type="date"
            value={from}
            onChange={(e) => onFromChange(e.target.value)}
            className="admin-toolbar-input"
            aria-label="시작일"
          />
          <span className="text-on-surface-variant text-xs select-none">~</span>
          <input
            type="date"
            value={to}
            onChange={(e) => onToChange(e.target.value)}
            className="admin-toolbar-input"
            aria-label="종료일"
          />
          <button type="button" onClick={onApply} className="score-list-toolbar-apply">
            적용
          </button>
        </div>
        <span className="score-list-toolbar-divider hidden sm:block" aria-hidden />
        <div className="score-list-toolbar-field score-list-toolbar-search">
          <span className="score-list-toolbar-label">닉네임</span>
          <input
            type="search"
            value={nicknameQuery}
            onChange={(e) => onNicknameChange(e.target.value)}
            placeholder="검색"
            className="admin-toolbar-input score-list-toolbar-search-input"
          />
        </div>
        <span className="score-list-toolbar-meta ml-auto">{countLabel}</span>
      </div>
      <div className="score-list-heading shrink-0">
        <h2 className="text-sm font-bold text-on-surface">{title}</h2>
        <span className="text-[10px] text-on-surface-variant">
          {from} ~ {to}
        </span>
      </div>
    </>
  );
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

  const toolbarProps = {
    from,
    to,
    nicknameQuery,
    onFromChange: setFrom,
    onToChange: setTo,
    onApply: applyPeriod,
    onNicknameChange: setNicknameQuery,
  };

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
        <section className="score-record-panel glass-panel rounded-xl flex-1 min-h-0 flex flex-col overflow-hidden">
          <ScoresListToolbar
            {...toolbarProps}
            title="승점 순위"
            countLabel={`${filteredRanking.length}명`}
          />
          <div className="flex-1 min-h-0 overflow-auto score-list-table-wrap">
            <table className="score-list-table w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left w-12">순위</th>
                  <th className="text-left">닉네임</th>
                  <th className="text-right">총점</th>
                  <th className="text-right">출석일</th>
                </tr>
              </thead>
              <tbody>
                {filteredRanking.map((row, i) => (
                  <tr key={row.nickname}>
                    <td className="text-on-surface-variant">{i + 1}</td>
                    <td className="font-semibold">{row.nickname}</td>
                    <td className="text-right font-bold text-primary tabular-nums">
                      {row.total_points}
                    </td>
                    <td className="text-right text-on-surface-variant tabular-nums">
                      {row.visit_days}
                    </td>
                  </tr>
                ))}
                {filteredRanking.length === 0 && (
                  <tr>
                    <td colSpan={4} className="score-list-empty">
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
        <section className="score-record-panel glass-panel rounded-xl flex-1 min-h-0 flex flex-col overflow-hidden">
          <ScoresListToolbar
            {...toolbarProps}
            title="출석 조회"
            countLabel={`${filteredAttendance.length}명`}
          />
          <div className="flex-1 min-h-0 overflow-auto score-list-table-wrap">
            <table className="score-list-table w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left">닉네임</th>
                  <th className="text-right w-20">방문</th>
                  <th className="text-right w-20">게임</th>
                  <th className="text-left pl-4">방문 날짜</th>
                </tr>
              </thead>
              <tbody>
                {filteredAttendance.map((row) => (
                  <tr key={row.nickname} className="align-top">
                    <td className="font-semibold">{row.nickname}</td>
                    <td className="text-right font-bold text-secondary tabular-nums">
                      {row.visit_count}회
                    </td>
                    <td className="text-right font-semibold text-primary tabular-nums">
                      {row.game_count}회
                    </td>
                    <td className="pl-4 text-on-surface-variant text-xs leading-relaxed">
                      {row.visit_dates.map(formatDateKo).join(", ")}
                    </td>
                  </tr>
                ))}
                {filteredAttendance.length === 0 && (
                  <tr>
                    <td colSpan={4} className="score-list-empty">
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
