"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PokerTableOval } from "@/components/poker/PokerTableOval";
import { assignSeat, sitOutPlayer, manualRebuy } from "@/lib/actions/games";
import type { MemberVisitWithMember, PhysicalTable, Seat, Game } from "@/lib/types";
import { formatChips } from "@/lib/utils/format";

type Props = {
  table: PhysicalTable;
  game: Game | null;
  seats: Seat[];
  activeVisits: MemberVisitWithMember[];
};

export function TableDetailClient({
  table,
  game,
  seats,
  activeVisits,
}: Props) {
  const router = useRouter();
  const [pickerSeat, setPickerSeat] = useState<number | null>(null);

  const totalChips = seats.reduce((s, x) => s + Number(x.chips), 0);
  const occupied = seats.filter((s) => s.member_id);
  const avg = occupied.length ? Math.round(totalChips / occupied.length) : 0;

  async function handleAssign(visit: MemberVisitWithMember) {
    if (!game || pickerSeat === null) return;
    await assignSeat(game.id, table.id, pickerSeat, visit.member_id, visit.id);
    setPickerSeat(null);
    router.refresh();
  }

  async function handleSitOut(seat: Seat) {
    if (!game || !seat.member_id) return;
    await sitOutPlayer(seat.member_id, game.id);
    router.refresh();
  }

  async function handleManualRebuy(seat: Seat) {
    if (!game || !seat.member_id) return;
    await manualRebuy(game.id, seat.id, seat.member_id);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-panel rounded-2xl p-5 border-t-2 border-primary/50">
          <p className="text-[10px] uppercase tracking-[0.15em] text-on-surface-variant font-semibold">총 칩</p>
          <p className="stat-display stat-display-xl text-primary text-glow-primary mt-1">{formatChips(totalChips)}</p>
        </div>
        <div className="glass-panel rounded-2xl p-5 border-t-2 border-tertiary/50">
          <p className="text-[10px] uppercase tracking-[0.15em] text-on-surface-variant font-semibold">평균 칩</p>
          <p className="stat-display stat-display-xl text-tertiary text-glow-tertiary mt-1">{formatChips(avg)}</p>
        </div>
        <div className="glass-panel rounded-2xl p-5 border-t-2 border-secondary/50">
          <p className="text-[10px] uppercase tracking-[0.15em] text-on-surface-variant font-semibold">착석</p>
          <p className="stat-display stat-display-xl text-secondary text-glow-secondary mt-1">
            {occupied.length}
            <span className="text-lg text-on-surface-variant/60 font-semibold">/11</span>
          </p>
        </div>
        {game && (
          <div className="glass-panel rounded-xl p-4">
            <p className="text-xs text-on-surface-variant">레지</p>
            <p className="text-sm font-bold">
              {game.registration_closed ? "마감" : "오픈"}
            </p>
          </div>
        )}
      </div>

      {game ? (
        <>
          <PokerTableOval
            tableCode={table.code}
            seats={seats}
            onSeatClick={(n) => setPickerSeat(n)}
          />
          {pickerSeat !== null && (
            <div className="glass-panel rounded-xl p-4 border border-primary/40">
              <p className="text-sm font-bold mb-3">
                좌석 {pickerSeat} — 방문 중 손님
              </p>
              <div className="flex flex-wrap gap-2">
                {activeVisits.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => handleAssign(v)}
                    className="px-3 py-2 rounded-lg bg-surface-container-high hover:bg-primary/20 text-sm"
                  >
                    {v.members?.nickname ?? v.member_id}
                    {v.members && v.members.credit_balance < 0 && (
                      <span className="text-error text-xs ml-1">
                        ({v.members.credit_balance.toLocaleString()})
                      </span>
                    )}
                  </button>
                ))}
                {activeVisits.length === 0 && (
                  <p className="text-sm text-on-surface-variant">
                    방문 중 손님이 없습니다. 접수대에서 조회하세요.
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setPickerSeat(null)}
                className="mt-3 text-xs text-on-surface-variant"
              >
                취소
              </button>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {seats
              .filter((s) => s.member_id)
              .map((seat) => (
                <div key={seat.id} className="glass-panel rounded-lg px-3 py-2 text-sm flex gap-2 items-center">
                  <span>S{seat.seat_number}</span>
                  <button
                    type="button"
                    onClick={() => handleSitOut(seat)}
                    className="text-error hover:underline"
                  >
                    싯아웃
                  </button>
                  <button
                    type="button"
                    onClick={() => handleManualRebuy(seat)}
                    className="text-primary hover:underline"
                    title={game.registration_closed ? "수동 리바인" : "리바인"}
                  >
                    리바인{game.registration_closed ? "(수동)" : ""}
                  </button>
                </div>
              ))}
          </div>
        </>
      ) : (
        <p className="text-on-surface-variant">연결된 게임이 없습니다.</p>
      )}
    </div>
  );
}
