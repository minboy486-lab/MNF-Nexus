"use client";

import { useEffect } from "react";
import { IntegratedTableCard } from "@/components/tables/IntegratedTableCard";
import type { IntegratedTableItem } from "@/lib/tables/integrated-table";
import type { MemberVisitWithMember } from "@/lib/types";

type Props = {
  table: IntegratedTableItem;
  defaultBuyIn: number;
  activeVisits: MemberVisitWithMember[];
  inGameMemberIds: string[];
  allTables: IntegratedTableItem[];
  onStartGame: (tableId: string) => void;
  onClose: () => void;
};

export function TableAZoomOverlay({
  table,
  defaultBuyIn,
  activeVisits,
  inGameMemberIds,
  allTables,
  onStartGame,
  onClose,
}: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="integrated-table-a-overlay fixed inset-0 z-[150] flex items-center justify-center p-3 sm:p-6 md:p-8"
      role="dialog"
      aria-modal="true"
      aria-label="Table A 확대"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/85 backdrop-blur-sm integrated-table-a-backdrop"
        aria-label="닫기"
        onClick={onClose}
      />
      <div className="integrated-table-a-zoom relative z-10 w-full max-w-5xl h-[min(88dvh,52rem)] flex flex-col min-h-0">
        <button
          type="button"
          onClick={onClose}
          className="absolute -top-1 right-0 sm:right-2 z-20 p-2 rounded-xl border border-white/15 bg-surface-container-high/90 hover:bg-white/10 text-on-surface-variant"
          aria-label="닫기"
        >
          <span className="material-symbols-outlined text-xl">close</span>
        </button>
        <IntegratedTableCard
          table={table}
          defaultBuyIn={defaultBuyIn}
          activeVisits={activeVisits}
          inGameMemberIds={inGameMemberIds}
          allTables={allTables}
          onStartGame={onStartGame}
          zoomed
        />
      </div>
    </div>
  );
}
