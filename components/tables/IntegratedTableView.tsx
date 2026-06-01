"use client";

import Link from "next/link";
import { PokerTableOval } from "@/components/poker/PokerTableOval";
import type { IntegratedTableItem } from "@/lib/tables/integrated-table";

type Props = {
  tables: IntegratedTableItem[];
};

export function IntegratedTableView({ tables }: Props) {
  return (
    <div className="integrated-table-view admin-main flex-1 overflow-y-auto p-6 md:p-8">
      <div className="flex flex-wrap justify-between items-center gap-4 mb-8 border-b border-white/5 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">
            통합 테이블 관제 뷰
          </h1>
          <p className="text-xs text-on-surface-variant mt-1">
            실제 매장 동선 배치 (주요 테이블: D · B · C 중심)
          </p>
        </div>
        <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-full border border-white/10 backdrop-blur-md">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary-container" />
          </span>
          <span className="text-xs font-mono tracking-wider text-primary">LIVE MONITOR</span>
        </div>
      </div>

      <div className="grid grid-cols-12 grid-rows-6 gap-4 md:gap-6 h-[calc(100vh-200px)] min-h-[560px] max-h-[900px]">
        {tables.map((table) => (
          <Link
            key={table.tableId}
            href={`/admin/tables/${table.tableId}`}
            className={`${table.gridClass} relative glass-panel rounded-3xl p-4 md:p-5 flex flex-col justify-between transition-all duration-300 hover:scale-[1.01] ${
              table.isRunning ? "card-running" : ""
            }`}
          >
            <div className="flex justify-between items-start z-10 gap-2">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 shrink-0 rounded-full bg-gradient-to-tr from-primary to-secondary flex items-center justify-center font-bold text-sm text-on-primary">
                  {table.code}
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-lg tracking-wide truncate">{table.name}</h3>
                  <span
                    className={`text-[10px] font-mono tracking-wider ${
                      table.isRunning ? "text-primary" : "text-on-surface-variant"
                    }`}
                  >
                    • {table.statusLabel}
                  </span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <span className="text-[10px] text-on-surface-variant block">칩 합계</span>
                <span className="stat-display text-xl text-primary text-glow-primary">
                  {table.totalChips}
                </span>
                <span className="text-[10px] text-on-surface-variant block stat-display text-sm">
                  {table.occupied}/11명
                </span>
              </div>
            </div>

            <div className="flex-1 flex items-center justify-center my-3 min-h-0">
              {table.isRunning ? (
                <div className="w-full max-w-[280px]">
                  <PokerTableOval tableCode={table.code} seats={table.seats} compact />
                </div>
              ) : (
                <p className="text-sm font-semibold text-on-surface-variant/60 tracking-wider">
                  게임 없음
                </p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
