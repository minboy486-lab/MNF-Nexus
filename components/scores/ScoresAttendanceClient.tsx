"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { addManualScore, deleteManualScore } from "@/lib/actions/manual-scores";
import { NicknameAutocomplete } from "@/components/scores/NicknameAutocomplete";
import type {
  AttendanceRow,
  ManualScoreDaily,
  MemberSuggestion,
  ScoreRankingRow,
} from "@/lib/scores/types";
import { dailyTotalPoints } from "@/lib/scores/types";

type Tab = "record" | "ranking" | "attendance";

type Props = {
  members: MemberSuggestion[];
  todayScores: ManualScoreDaily[];
  ranking: ScoreRankingRow[];
  attendance: AttendanceRow[];
  defaultDate: string;
  periodFrom: string;
  periodTo: string;
};

function formatDateKo(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${Number(m)}월 ${Number(d)}일`;
}

export function ScoresAttendanceClient({
  members,
  todayScores: initialTodayScores,
  ranking: initialRanking,
  attendance: initialAttendance,
  defaultDate,
  periodFrom,
  periodTo,
}: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("record");
  const [playDate, setPlayDate] = useState(defaultDate);
  const [from, setFrom] = useState(periodFrom);
  const [to, setTo] = useState(periodTo);
  const [nickname, setNickname] = useState("");
  const [buyIn, setBuyIn] = useState("");
  const [rebuy, setRebuy] = useState("");
  const [moneyIn, setMoneyIn] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const todayTotal = useMemo(
    () => initialTodayScores.reduce((sum, r) => sum + dailyTotalPoints(r), 0),
    [initialTodayScores],
  );

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setMessage(null);
    const result = await addManualScore({
      playDate,
      nickname,
      buyInPoints: Number(buyIn) || 0,
      rebuyPoints: Number(rebuy) || 0,
      moneyInPoints: Number(moneyIn) || 0,
    });
    setPending(false);
    if ("error" in result && result.error) {
      setError(result.error);
      return;
    }
    setNickname("");
    setBuyIn("");
    setRebuy("");
    setMoneyIn("");
    setMessage(
      result.memberCreated
        ? `${result.nickname} 손님을 새로 등록하고 기록했습니다.`
        : `${result.nickname} 기록을 추가했습니다.`,
    );
    router.refresh();
  }

  async function handleDelete(id: string) {
    if (!confirm("이 기록을 삭제할까요?")) return;
    setPending(true);
    const result = await deleteManualScore(id);
    setPending(false);
    if ("error" in result && result.error) alert(result.error);
    else router.refresh();
  }

  function applyPeriod() {
    router.push(`/admin/scores?from=${from}&to=${to}&date=${playDate}`);
  }

  function loadDateScores() {
    router.push(`/admin/scores?from=${from}&to=${to}&date=${playDate}`);
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
      </div>

      {tab === "record" && (
        <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-0">
          <section className="glass-panel rounded-xl p-4 lg:w-80 shrink-0 space-y-3">
            <h2 className="font-bold text-sm">점수 입력</h2>
            <p className="text-[11px] text-on-surface-variant leading-relaxed">
              같은 날짜·닉네임은 한 줄로 합쳐지고 점수는 누적됩니다. 출석은 날짜당 1회만
              집계됩니다.
            </p>
            <form onSubmit={handleAdd} className="space-y-3">
              <label className="block text-xs text-on-surface-variant">
                날짜
                <div className="flex gap-2 mt-1">
                  <input
                    type="date"
                    value={playDate}
                    onChange={(e) => setPlayDate(e.target.value)}
                    required
                    className="login-input w-full text-sm"
                  />
                  <button
                    type="button"
                    onClick={loadDateScores}
                    className="shrink-0 px-2 py-1 rounded-lg text-xs border border-white/15 hover:bg-white/5"
                  >
                    조회
                  </button>
                </div>
              </label>
              <label className="block text-xs text-on-surface-variant">
                닉네임
                <div className="mt-1">
                  <NicknameAutocomplete
                    members={members}
                    value={nickname}
                    onChange={setNickname}
                    disabled={pending}
                  />
                </div>
              </label>
              <div className="grid grid-cols-3 gap-2">
                <label className="text-xs text-on-surface-variant">
                  바이인
                  <input
                    type="number"
                    min={0}
                    value={buyIn}
                    onChange={(e) => setBuyIn(e.target.value)}
                    className="login-input w-full text-sm mt-1"
                    placeholder="0"
                  />
                </label>
                <label className="text-xs text-on-surface-variant">
                  리바인
                  <input
                    type="number"
                    min={0}
                    value={rebuy}
                    onChange={(e) => setRebuy(e.target.value)}
                    className="login-input w-full text-sm mt-1"
                    placeholder="0"
                  />
                </label>
                <label className="text-xs text-on-surface-variant">
                  머니인
                  <input
                    type="number"
                    min={0}
                    value={moneyIn}
                    onChange={(e) => setMoneyIn(e.target.value)}
                    className="login-input w-full text-sm mt-1"
                    placeholder="0"
                  />
                </label>
              </div>
              {error && (
                <p className="text-xs text-error bg-error/10 border border-error/30 rounded-lg px-2 py-1.5">
                  {error}
                </p>
              )}
              {message && (
                <p className="text-xs text-primary bg-primary/10 border border-primary/30 rounded-lg px-2 py-1.5">
                  {message}
                </p>
              )}
              <button
                type="submit"
                disabled={pending || !nickname.trim()}
                className="btn-primary w-full py-2.5 rounded-lg text-sm font-semibold disabled:opacity-50"
              >
                {pending ? "저장 중…" : "기록 추가"}
              </button>
            </form>
          </section>

          <section className="glass-panel rounded-xl p-4 flex-1 min-h-0 flex flex-col">
            <div className="flex items-center justify-between mb-3 shrink-0">
              <h2 className="font-bold text-sm">
                {formatDateKo(playDate)} 기록 ({initialTodayScores.length}명)
              </h2>
              <span className="text-xs text-on-surface-variant">
                일 합계 <span className="text-primary font-bold">{todayTotal}</span>점
              </span>
            </div>
            <div className="flex-1 min-h-0 overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-[#141218]">
                  <tr className="text-on-surface-variant border-b border-white/10 text-xs">
                    <th className="text-left py-2 pr-2">닉네임</th>
                    <th className="text-right py-2 px-1">바이인</th>
                    <th className="text-right py-2 px-1">리바인</th>
                    <th className="text-right py-2 px-1">머니인</th>
                    <th className="text-right py-2 px-1">합계</th>
                    <th className="py-2 w-8" />
                  </tr>
                </thead>
                <tbody>
                  {initialTodayScores.map((row) => (
                    <tr key={row.id} className="border-b border-white/5">
                      <td className="py-2 pr-2 font-semibold">{row.nickname}</td>
                      <td className="text-right py-2 px-1 tabular-nums">{row.buy_in_points}</td>
                      <td className="text-right py-2 px-1 tabular-nums">{row.rebuy_points}</td>
                      <td className="text-right py-2 px-1 tabular-nums">{row.money_in_points}</td>
                      <td className="text-right py-2 px-1 tabular-nums font-bold text-primary">
                        {dailyTotalPoints(row)}
                      </td>
                      <td className="py-2 text-right">
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => handleDelete(row.id)}
                          className="text-error/70 hover:text-error text-xs"
                          aria-label="삭제"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                  {initialTodayScores.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-on-surface-variant text-sm">
                        이 날짜 기록이 없습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
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
                {initialRanking.map((row, i) => (
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
                {initialRanking.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-on-surface-variant">
                      기간 내 기록이 없습니다.
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
                  <th className="text-left py-2 pl-4">방문 날짜</th>
                </tr>
              </thead>
              <tbody>
                {initialAttendance.map((row) => (
                  <tr key={row.nickname} className="border-b border-white/5 align-top">
                    <td className="py-2.5 font-semibold">{row.nickname}</td>
                    <td className="py-2.5 text-right font-bold text-secondary tabular-nums">
                      {row.visit_count}회
                    </td>
                    <td className="py-2.5 pl-4 text-on-surface-variant text-xs leading-relaxed">
                      {row.visit_dates.map(formatDateKo).join(", ")}
                    </td>
                  </tr>
                ))}
                {initialAttendance.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-8 text-center text-on-surface-variant">
                      기간 내 출석 기록이 없습니다.
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
