"use client";

import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import {
  getSeatCapsuleAnchor,
  type SeatAnchorPlacement,
} from "@/lib/poker/seat-capsule";

type Props = {
  seatNumber: number;
  /** 같은 화면에 테이블이 여러 개일 때 좌석 DOM 범위 */
  anchorScopeId: string;
  title: string;
  onClose: () => void;
  children: ReactNode;
  widthClass?: string;
};

type PopoverPos = {
  top: number;
  left: number;
  maxHeight: number;
};

const PAD = 6;
const GAP = 10;

function placementOrder(preferred: SeatAnchorPlacement): SeatAnchorPlacement[] {
  switch (preferred) {
    case "above":
      return ["above", "below", "right", "left"];
    case "below":
      return ["below", "above", "right", "left"];
    case "left":
      return ["left", "right", "above", "below"];
    default:
      return ["right", "left", "above", "below"];
  }
}

function coordsForPlacement(
  placement: SeatAnchorPlacement,
  anchor: { left: number; top: number; right: number; bottom: number; width: number; height: number },
  popW: number,
  popH: number,
): { top: number; left: number } {
  const cx = anchor.left + anchor.width / 2;
  const cy = anchor.top + anchor.height / 2;

  switch (placement) {
    case "above":
      return { top: anchor.top - GAP - popH, left: cx - popW / 2 };
    case "below":
      return { top: anchor.bottom + GAP, left: cx - popW / 2 };
    case "left":
      return { top: cy - popH / 2, left: anchor.left - GAP - popW };
    default:
      return { top: cy - popH / 2, left: anchor.right + GAP };
  }
}

function fitsBounds(
  top: number,
  left: number,
  popW: number,
  popH: number,
  boundsW: number,
  boundsH: number,
): boolean {
  return (
    top >= PAD &&
    left >= PAD &&
    top + popH <= boundsH - PAD &&
    left + popW <= boundsW - PAD
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function computePopoverPosition(
  anchor: { left: number; top: number; right: number; bottom: number; width: number; height: number },
  preferred: SeatAnchorPlacement,
  popW: number,
  popH: number,
  boundsW: number,
  boundsH: number,
): PopoverPos {
  for (const placement of placementOrder(preferred)) {
    const { top, left } = coordsForPlacement(placement, anchor, popW, popH);
    if (fitsBounds(top, left, popW, popH, boundsW, boundsH)) {
      return { top, left, maxHeight: Math.min(popH, boundsH - top - PAD) };
    }
  }

  const cx = anchor.left + anchor.width / 2;
  const left = clamp(cx - popW / 2, PAD, boundsW - popW - PAD);
  let top = anchor.top - GAP - popH;
  if (top < PAD) top = anchor.bottom + GAP;
  top = clamp(top, PAD, Math.max(PAD, boundsH - popH - PAD));
  const maxHeight = Math.max(100, boundsH - top - PAD);

  return { top, left, maxHeight };
}

export function SeatAnchoredPopover({
  seatNumber,
  anchorScopeId,
  title,
  onClose,
  children,
  widthClass = "w-44 sm:w-52",
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<PopoverPos | null>(null);

  const updatePosition = useCallback(() => {
    const container = document.querySelector(
      `[data-table-anchor="${anchorScopeId}"]`,
    ) as HTMLElement | null;
    const seatEl = container?.querySelector(
      `[data-seat-anchor="${seatNumber}"]`,
    ) as HTMLElement | null;
    const panel = panelRef.current;
    if (!container || !seatEl || !panel) return;

    const containerRect = container.getBoundingClientRect();
    const seatRect = seatEl.getBoundingClientRect();
    const popRect = panel.getBoundingClientRect();

    const anchor = {
      left: seatRect.left - containerRect.left,
      top: seatRect.top - containerRect.top,
      right: seatRect.right - containerRect.left,
      bottom: seatRect.bottom - containerRect.top,
      width: seatRect.width,
      height: seatRect.height,
    };

    const preferred = getSeatCapsuleAnchor(seatNumber).placement;
    setPos(
      computePopoverPosition(
        anchor,
        preferred,
        popRect.width,
        popRect.height,
        containerRect.width,
        containerRect.height,
      ),
    );
  }, [anchorScopeId, seatNumber]);

  useLayoutEffect(() => {
    updatePosition();
  }, [updatePosition, children]);

  useLayoutEffect(() => {
    const container = document.querySelector(
      `[data-table-anchor="${anchorScopeId}"]`,
    ) as HTMLElement | null;
    if (!container) return;

    const observer = new ResizeObserver(() => updatePosition());
    observer.observe(container);
    window.addEventListener("resize", updatePosition);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updatePosition);
    };
  }, [anchorScopeId, updatePosition]);

  return (
    <>
      <button
        type="button"
        className="absolute inset-0 z-30 cursor-default"
        aria-label="닫기"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        className={`absolute z-40 seat-popover-panel rounded-xl border border-primary/35 shadow-2xl ${widthClass} flex flex-col overflow-hidden`}
        style={{
          top: pos?.top ?? 0,
          left: pos?.left ?? 0,
          maxHeight: pos?.maxHeight ?? 280,
          visibility: pos ? "visible" : "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={title}
      >
        <div className="shrink-0 flex items-center justify-between gap-2 px-3 py-2 border-b border-white/10 bg-[#1c1a22]">
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
        <div className="seat-popover-body flex-1 min-h-0 overflow-y-auto">{children}</div>
      </div>
    </>
  );
}
