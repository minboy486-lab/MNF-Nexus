"use client";

import type { ReactNode } from "react";
import { getSeatCapsuleAnchor } from "@/lib/poker/seat-capsule";

type Props = {
  seatNumber: number;
  title: string;
  onClose: () => void;
  children: ReactNode;
  widthClass?: string;
};

export function SeatAnchoredPopover({
  seatNumber,
  title,
  onClose,
  children,
  widthClass = "w-44 sm:w-52",
}: Props) {
  const anchor = getSeatCapsuleAnchor(seatNumber);
  const offset =
    anchor.place === "right" ? "translate(10px, -50%)" : "translate(calc(-100% - 10px), -50%)";

  return (
    <>
      <button
        type="button"
        className="absolute inset-0 z-30 cursor-default"
        aria-label="닫기"
        onClick={onClose}
      />
      <div
        className={`absolute z-40 glass-panel rounded-xl border border-primary/35 shadow-2xl ${widthClass} max-h-[min(70vh,320px)] flex flex-col overflow-hidden`}
        style={{
          left: `${anchor.left}%`,
          top: `${anchor.top}%`,
          transform: offset,
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={title}
      >
        <div className="shrink-0 flex items-center justify-between gap-2 px-3 py-2 border-b border-white/10 bg-surface-container-high/50">
          <h4 className="text-xs font-bold truncate">{title}</h4>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-white/10 text-on-surface-variant shrink-0"
            aria-label="닫기"
          >
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        </div>
        {children}
      </div>
    </>
  );
}
