"use client";

import { useState } from "react";
import { useAdminNavOptional } from "@/components/admin/AdminNavContext";
import { StartGameModal } from "@/components/games/StartGameModal";
import { IntegratedTableCard } from "@/components/tables/IntegratedTableCard";
import type { IntegratedTableItem } from "@/lib/tables/integrated-table";
import type { GamePreset, MemberVisitWithMember, PhysicalTable } from "@/lib/types";

const FLOOR_ORDER = ["D", "B", "C"] as const;

type Props = {
  tables: IntegratedTableItem[];
  physicalTables: PhysicalTable[];
  presets: GamePreset[];
  activeVisits: MemberVisitWithMember[];
  defaultBuyIn: number;
  /** 직원 앱: 관리자 사이드바 메뉴 버튼 숨김 */
  staffMode?: boolean;
};

export function IntegratedTableView({
  tables,
  physicalTables,
  presets,
  activeVisits,
  defaultBuyIn,
  staffMode,
}: Props) {
  const adminNav = useAdminNavOptional();
  const openMobileNav = staffMode ? undefined : adminNav?.openMobileNav;
  const defaultPresetId = presets[0]?.id;
  const [startGameTableId, setStartGameTableId] = useState<string | null>(null);

  const ordered = [...tables].sort(
    (a, b) => FLOOR_ORDER.indexOf(a.code as (typeof FLOOR_ORDER)[number]) - FLOOR_ORDER.indexOf(b.code as (typeof FLOOR_ORDER)[number]),
  );

  return (
    <div className="integrated-table-view flex-1 flex flex-col min-h-0 overflow-hidden px-2 py-3 md:px-3 md:py-4 w-full">
      <div className="flex flex-wrap justify-between items-center gap-2 mb-2 border-b border-white/5 pb-2 shrink-0">
        <div className="flex items-start gap-2 min-w-0 flex-1">
          {!staffMode && openMobileNav && (
            <button
              type="button"
              onClick={openMobileNav}
              className="md:hidden shrink-0 p-2 rounded-lg border border-white/10 bg-surface-container-low/60 hover:bg-white/10"
              aria-label="메뉴 열기"
            >
              <span className="material-symbols-outlined text-2xl">menu</span>
            </button>
          )}
          <div className="min-w-0">
          <h1 className="text-lg md:text-xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">
            {staffMode ? "테이블" : "통합 테이블 관제 뷰"}
          </h1>
          <p className="text-[10px] text-on-surface-variant">
            B(상단) · D/C(하단) — 좌석 탭 시 방문 중 손님 배정
          </p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-white/5 px-2.5 py-1 rounded-full border border-white/10">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary-container" />
          </span>
          <span className="text-[10px] font-mono tracking-wider text-primary">LIVE</span>
        </div>
      </div>

      <div className="integrated-table-floor flex-1 min-h-0 w-full">
        {(() => {
          const byCode = Object.fromEntries(ordered.map((t) => [t.code, t]));
          const tableB = byCode.B;
          const tableD = byCode.D;
          const tableC = byCode.C;
          const cardProps = {
            defaultPresetId,
            defaultBuyIn,
            activeVisits,
            onStartGame: (tableId: string) => setStartGameTableId(tableId),
          };
          return (
            <>
              {tableB && (
                <IntegratedTableCard key={tableB.tableId} table={tableB} {...cardProps} />
              )}
              <div className="integrated-table-pair">
                {tableD && (
                  <IntegratedTableCard key={tableD.tableId} table={tableD} {...cardProps} />
                )}
                {tableC && (
                  <IntegratedTableCard key={tableC.tableId} table={tableC} {...cardProps} />
                )}
              </div>
            </>
          );
        })()}
      </div>

      {startGameTableId && (
        <StartGameModal
          presets={presets}
          tables={physicalTables}
          initialTableId={startGameTableId}
          onClose={() => setStartGameTableId(null)}
        />
      )}
    </div>
  );
}
