"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  updateGamePrizeConfig,
  recordElimination,
  updatePlacementAmount,
  recalculateSuggestions,
  saveIcmChop,
  applyIcmToTopThree,
  finalizeGameSettlement,
} from "@/lib/actions/prize";
import type { GameFinishPlacement, GameIcmChop, Member, Seat } from "@/lib/types";
import { formatChips } from "@/lib/utils/format";

type GameRow = {
  id: string;
  total_prize_pool: number;
  payout_places: number;
  settlement_status: string;
  survivor_count: number;
  game_presets?: { name: string } | null;
};

type Props = {
  game: GameRow;
  placements: GameFinishPlacement[];
  icm: GameIcmChop | null;
  survivors: (Seat & { members: Member | null })[];
};

export function GameSettlementClient({ game, placements, icm, survivors }: Props) {
  const router = useRouter();
  const [totalPool, setTotalPool] = useState(String(game.total_prize_pool || 0));
  const [payoutPlaces, setPayoutPlaces] = useState(String(game.payout_places || 5));
  const [elimMemberId, setElimMemberId] = useState("");
  const [elimChips, setElimChips] = useState("");
  const [icmInputs, setIcmInputs] = useState<
    { memberId: string; nickname: string; chips: number }[]
  >(
    survivors.map((s) => ({
      memberId: s.member_id!,
      nickname: s.members?.nickname ?? "?",
      chips: Number(s.chips) || 0,
    })),
  );

  const paidSum = placements.reduce((s, p) => s + Number(p.final_amount), 0);
  const remaining = Math.max(0, Number(totalPool) - paidSum);

  const survivorOptions = useMemo(
    () =>
      survivors.filter((s) => s.member_id && !placements.some((p) => p.member_id === s.member_id)),
    [survivors, placements],
  );

  async function saveConfig() {
    await updateGamePrizeConfig(game.id, {
      totalPrizePool: Number(totalPool),
      payoutPlaces: Number(payoutPlaces),
    });
    await recalculateSuggestions(game.id);
    router.refresh();
  }

  async function handleEliminate() {
    if (!elimMemberId) return;
    const res = await recordElimination(
      game.id,
      elimMemberId,
      elimChips ? Number(elimChips) : undefined,
    );
    if ("error" in res && res.error) alert(res.error);
    setElimMemberId("");
    setElimChips("");
    router.refresh();
  }

  async function handleIcm() {
    const res = await saveIcmChop(game.id, icmInputs);
    if ("error" in res && res.error) alert(res.error);
    else await applyIcmToTopThree(game.id);
    router.refresh();
  }

  async function handleFinalize() {
    if (!confirm("프라이즈를 확정하고 게임을 마감할까요?")) return;
    const res = await finalizeGameSettlement(game.id);
    if ("error" in res && res.error) alert(res.error);
    router.refresh();
  }

  const icmResults = (icm?.results ?? []) as {
    member_id: string;
    nickname: string;
    icm_amount: number;
  }[];

  return (
    <div className="space-y-8 max-w-4xl">
      <div className="flex flex-wrap gap-3">
        <Link href={`/admin/games/${game.id}`} className="text-primary text-sm hover:underline">
          ← 게임 운영
        </Link>
      </div>

      <section className="glass-panel rounded-xl p-5 space-y-4">
        <h2 className="font-bold text-lg">프라이즈 설정</h2>
        <p className="text-sm text-on-surface-variant">
          {game.game_presets?.name ?? "게임"} · 생존 {game.survivor_count}명
        </p>
        <div className="grid sm:grid-cols-2 gap-4">
          <label className="block text-sm">
            총 상금 (원)
            <input
              type="number"
              value={totalPool}
              onChange={(e) => setTotalPool(e.target.value)}
              className="mt-1 w-full bg-surface-container-low border border-white/10 rounded-lg py-2 px-3"
            />
          </label>
          <label className="block text-sm">
            지급 인원
            <input
              type="number"
              min={1}
              max={20}
              value={payoutPlaces}
              onChange={(e) => setPayoutPlaces(e.target.value)}
              className="mt-1 w-full bg-surface-container-low border border-white/10 rounded-lg py-2 px-3"
            />
          </label>
        </div>
        <button
          type="button"
          onClick={saveConfig}
          className="bg-primary text-on-primary font-bold px-4 py-2 rounded-lg text-sm"
        >
          저장 · 추천금 재계산
        </button>
        <p className="text-sm">
          지급 합계: <strong>{formatChips(paidSum)}</strong> · 잔여:{" "}
          <strong className={remaining > 0 ? "text-tertiary" : "text-primary"}>
            {formatChips(remaining)}
          </strong>
        </p>
      </section>

      <section className="glass-panel rounded-xl p-5 space-y-4">
        <h2 className="font-bold">핸디 탈락 (낮은 등수부터)</h2>
        <div className="flex flex-wrap gap-2 items-end">
          <label className="text-sm flex-1 min-w-[140px]">
            손님
            <select
              value={elimMemberId}
              onChange={(e) => setElimMemberId(e.target.value)}
              className="mt-1 w-full bg-surface-container-low border border-white/10 rounded-lg py-2 px-2"
            >
              <option value="">선택</option>
              {survivorOptions.map((s) => (
                <option key={s.member_id!} value={s.member_id!}>
                  {s.members?.nickname} (S{s.seat_number})
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm w-32">
            칩 (선택)
            <input
              type="number"
              value={elimChips}
              onChange={(e) => setElimChips(e.target.value)}
              className="mt-1 w-full bg-surface-container-low border border-white/10 rounded-lg py-2 px-2"
            />
          </label>
          <button
            type="button"
            onClick={handleEliminate}
            className="bg-error/20 border border-error/40 text-error font-bold px-4 py-2 rounded-lg"
          >
            탈락 처리
          </button>
        </div>
      </section>

      <section className="glass-panel rounded-xl p-5">
        <h2 className="font-bold mb-3">등수 · 상금</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-on-surface-variant text-left border-b border-white/10">
                <th className="py-2 pr-4">등수</th>
                <th className="py-2 pr-4">손님</th>
                <th className="py-2 pr-4">추천</th>
                <th className="py-2">확정금액</th>
              </tr>
            </thead>
            <tbody>
              {placements.map((p) => (
                <tr key={p.id} className="border-b border-white/5">
                  <td className="py-3 pr-4 font-bold">{p.finish_rank}등</td>
                  <td className="py-3 pr-4">{p.members?.nickname}</td>
                  <td className="py-3 pr-4 text-on-surface-variant">
                    {formatChips(p.suggested_amount)}
                  </td>
                  <td className="py-3">
                    <input
                      type="number"
                      defaultValue={p.final_amount}
                      onBlur={(e) =>
                        updatePlacementAmount(p.id, Number(e.target.value)).then(() =>
                          router.refresh(),
                        )
                      }
                      className="w-28 bg-surface-container-low border border-white/10 rounded px-2 py-1"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {survivors.length > 0 && remaining > 0 && (
        <section className="glass-panel rounded-xl p-5 space-y-4 border border-tertiary/30">
          <h2 className="font-bold text-tertiary">ICM 찹 (잔여 {formatChips(remaining)})</h2>
          {icmInputs.map((row, i) => (
            <div key={row.memberId} className="flex gap-3 items-center flex-wrap">
              <span className="font-semibold w-24">{row.nickname}</span>
              <input
                type="number"
                value={row.chips}
                onChange={(e) => {
                  const next = [...icmInputs];
                  next[i] = { ...row, chips: Number(e.target.value) };
                  setIcmInputs(next);
                }}
                className="w-36 bg-surface-container-low border border-white/10 rounded-lg py-2 px-2"
                placeholder="칩"
              />
            </div>
          ))}
          <button
            type="button"
            onClick={handleIcm}
            className="bg-tertiary/30 border border-tertiary/50 font-bold px-4 py-2 rounded-lg"
          >
            ICM 계산 → 1~3등 반영
          </button>
          {icmResults.length > 0 && (
            <ul className="text-sm space-y-1">
              {icmResults.map((r) => (
                <li key={r.member_id}>
                  {r.nickname}: {formatChips(r.icm_amount)}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {game.settlement_status !== "finalized" && (
        <button
          type="button"
          onClick={handleFinalize}
          className="w-full bg-primary text-on-primary font-bold py-4 rounded-xl text-lg"
        >
          프라이즈 확정 · 게임 마감
        </button>
      )}
    </div>
  );
}
