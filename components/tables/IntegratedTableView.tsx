"use client";

import { useState } from "react";
import { AdminNavToggle } from "@/components/admin/AdminNavToggle";
import { StartGameModal } from "@/components/games/StartGameModal";
import { IntegratedTableCard } from "@/components/tables/IntegratedTableCard";
import { TableAZoomOverlay } from "@/components/tables/TableAZoomOverlay";
import type { IntegratedTableItem } from "@/lib/tables/integrated-table";
import type { GamePreset, MemberVisitWithMember, PhysicalTable } from "@/lib/types";

const FLOOR_ORDER = ["D", "B", "C"] as const;

type Props = {
  tables: IntegratedTableItem[];
  physicalTables: PhysicalTable[];
  presets: GamePreset[];
  activeVisits: MemberVisitWithMember[];
  inGameMemberIds: string[];
  defaultBuyIn: number;
  /** 직원 앱: 관리자 사이드바 메뉴 버튼 숨김 */
  staffMode?: boolean;
};

export function IntegratedTableView({
  tables,
  physicalTables,
  presets,
  activeVisits,
  inGameMemberIds,
  defaultBuyIn,
  staffMode,
}: Props) {
  const defaultPresetId = presets[0]?.id;
  const [startGameTableId, setStartGameTableId] = useState<string | null>(null);
  const [tableAExpanded, setTableAExpanded] = useState(false);

  const byCode = Object.fromEntries(tables.map((t) => [t.code, t]));
  const tableA = byCode.A;
  const floorTables = [...tables]
    .filter((t) => t.code !== "A")
    .sort(
      (a, b) =>
        FLOOR_ORDER.indexOf(a.code as (typeof FLOOR_ORDER)[number]) -
        FLOOR_ORDER.indexOf(b.code as (typeof FLOOR_ORDER)[number]),
    );
  const floorByCode = Object.fromEntries(floorTables.map((t) => [t.code, t]));
  const cardProps = {
    defaultPresetId,
    defaultBuyIn,
    activeVisits,
    inGameMemberIds,
    allTables: tables,
    onStartGame: (tableId: string) => setStartGameTableId(tableId),
  };

  return (
    <div className="integrated-table-view flex-1 flex flex-col min-h-0 overflow-hidden px-2 py-3 md:px-3 md:py-4 w-full">
      <div className="flex flex-wrap justify-between items-center gap-2 mb-2 border-b border-white/5 pb-2 shrink-0">
        <div className="flex items-start gap-2 min-w-0 flex-1">
          {!staffMode && <AdminNavToggle className="shrink-0 p-2 rounded-lg border border-white/10 bg-surface-container-low/60 hover:bg-white/10" />}
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
        {/* 모바일: B · D · C 동일 스택 + A 버튼 하단 */}
        <div className="integrated-table-mobile-stack lg:hidden flex flex-col gap-3 min-h-0 overflow-y-auto w-full">
          {floorByCode.B && (
            <IntegratedTableCard key={`m-${floorByCode.B.tableId}`} table={floorByCode.B} {...cardProps} />
          )}
          {floorByCode.D && (
            <IntegratedTableCard key={`m-${floorByCode.D.tableId}`} table={floorByCode.D} {...cardProps} />
          )}
          {floorByCode.C && (
            <IntegratedTableCard key={`m-${floorByCode.C.tableId}`} table={floorByCode.C} {...cardProps} />
          )}
          {tableA && (
            <button
              type="button"
              onClick={() => setTableAExpanded(true)}
              className="integrated-table-a-btn flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl border border-secondary/40 bg-secondary/15 hover:bg-secondary/25 text-secondary font-bold text-sm shrink-0"
              aria-label="Table A 확대"
            >
              <span className="w-7 h-7 rounded-full bg-gradient-to-tr from-secondary to-primary flex items-center justify-center text-xs text-on-primary font-black">
                A
              </span>
              A 테이블
            </button>
          )}
        </div>

        {/* 데스크톱: B 상단 중앙 · D/C 하단 */}
        <div className="integrated-table-desktop-floor hidden lg:flex lg:flex-col lg:flex-1 lg:min-h-0 lg:w-full lg:gap-2">
          <div className="integrated-table-b-row">
            {tableA && (
              <div className="integrated-table-a-col">
                <button
                  type="button"
                  onClick={() => setTableAExpanded(true)}
                  className="integrated-table-a-btn flex items-center gap-1.5 px-3 py-2 rounded-xl border border-secondary/40 bg-secondary/15 hover:bg-secondary/25 text-secondary font-bold text-xs sm:text-sm transition-colors"
                  aria-label="Table A 확대"
                >
                  <span className="w-6 h-6 rounded-full bg-gradient-to-tr from-secondary to-primary flex items-center justify-center text-[10px] text-on-primary font-black">
                    A
                  </span>
                  A 테이블
                </button>
              </div>
            )}
            {floorByCode.B && (
              <div className="integrated-table-b-slot">
                <IntegratedTableCard key={floorByCode.B.tableId} table={floorByCode.B} {...cardProps} />
              </div>
            )}
          </div>
          <div className="integrated-table-pair">
            {floorByCode.D && (
              <IntegratedTableCard key={floorByCode.D.tableId} table={floorByCode.D} {...cardProps} />
            )}
            {floorByCode.C && (
              <IntegratedTableCard key={floorByCode.C.tableId} table={floorByCode.C} {...cardProps} />
            )}
          </div>
        </div>
      </div>

      {tableAExpanded && tableA && (
        <TableAZoomOverlay
          table={tableA}
          defaultBuyIn={defaultBuyIn}
          activeVisits={activeVisits}
          inGameMemberIds={inGameMemberIds}
          allTables={tables}
          onStartGame={(id) => {
            setTableAExpanded(false);
            setStartGameTableId(id);
          }}
          onClose={() => setTableAExpanded(false)}
        />
      )}

      {startGameTableId && (
        <StartGameModal
          presets={presets}
          tables={physicalTables}
          runningTables={tables.filter((t) => t.hasGame && t.isRunning)}
          initialTableId={startGameTableId}
          onClose={() => setStartGameTableId(null)}
        />
      )}
    </div>
  );
}
