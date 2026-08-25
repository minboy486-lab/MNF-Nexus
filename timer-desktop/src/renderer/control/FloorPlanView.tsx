import { useEffect, useRef, useState } from "react";
import type { AppSnapshot, GameSession } from "../../shared/types";
import { tableLetter } from "../../shared/types";

type Props = {
  snapshot: AppSnapshot;
  onTableClick: (tableSlot: number, pos: { x: number; y: number }) => void;
  onMonitorClick: (monitorSlot: number, pos: { x: number; y: number }) => void;
};

function sessionForTable(snap: AppSnapshot, slot: number): GameSession | undefined {
  const gid = snap.tableAssignments[slot];
  return gid ? snap.sessions.find((s) => s.gameId === gid) : undefined;
}

function sessionForMonitor(snap: AppSnapshot, slot: number): GameSession | undefined {
  const gid = snap.monitorAssignments[slot];
  return gid ? snap.sessions.find((s) => s.gameId === gid) : undefined;
}

const MONITOR_HOTKEY: Record<number, string> = { 5: "Q", 3: "A", 1: "Z", 6: "R", 4: "F", 2: "V" };
const TABLE_HOTKEY:   Record<number, string> = { 5: "W", 3: "S", 1: "X", 6: "E", 4: "D", 2: "C" };

type SlotBtnProps = {
  label: string;
  hotkey?: string;
  sub?: string;
  active: boolean;
  variant: "table" | "monitor" | "monitor-h";
  dataSlot?: string;
  onClick: (pos: { x: number; y: number }) => void;
};

function SlotBtn({ label, hotkey, sub, active, variant, dataSlot, onClick }: SlotBtnProps) {
  return (
    <button
      type="button"
      data-slot={dataSlot}
      className={`slot-btn slot-btn--${variant} ${active ? "slot-btn--active" : ""}`}
      onClick={(e) => {
        const r = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
        onClick({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
      }}
    >
      <span className="slot-btn__label">{label}</span>
      {sub && <span className="slot-btn__sub">{sub}</span>}
      {hotkey && <span className="slot-btn__hotkey">{hotkey}</span>}
    </button>
  );
}

/**
 * 레이아웃:
 *
 * [M5][T5]  gap  [T6][M6]
 * [M3][T3]  gap  [T4][M4]
 *     [T1]  gap  [T2]
 *      [M1]      [M2]       ← T1/T2 열 가운데 정렬, 폭=세로형 높이
 */

export function FloorPlanView({ snapshot, onTableClick, onMonitorClick }: Props) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [monitorSize, setMonitorSize] = useState(68);

  // M열 셀 높이를 측정해서 M1/M2 너비로 사용 (세로형과 합동)
  useEffect(() => {
    const measure = () => {
      if (!rowRef.current) return;
      // M열(첫 번째 자식)의 높이를 측정
      const mCell = rowRef.current.firstElementChild as HTMLElement | null;
      if (!mCell) return;
      const h = mCell.getBoundingClientRect().height;
      if (h > 0) setMonitorSize(Math.round(h));
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (rowRef.current) ro.observe(rowRef.current);
    return () => ro.disconnect();
  }, []);

  function tBtn(slot: number) {
    const s = sessionForTable(snapshot, slot);
    return (
      <SlotBtn
        label={tableLetter(slot)}
        hotkey={TABLE_HOTKEY[slot]}
        sub={s ? `G${s.gameId}` : undefined}
        active={!!s}
        variant="table"
        dataSlot={`table-${slot}`}
        onClick={(pos) => onTableClick(slot, pos)}
      />
    );
  }

  function mBtn(slot: number) {
    const s = sessionForMonitor(snapshot, slot);
    return (
      <SlotBtn
        label={`M${slot}`}
        hotkey={MONITOR_HOTKEY[slot]}
        sub={s ? `G${s.gameId}` : undefined}
        active={!!s}
        variant="monitor"
        dataSlot={`monitor-${slot}`}
        onClick={(pos) => onMonitorClick(slot, pos)}
      />
    );
  }

  function mHBtn(slot: number) {
    const s = sessionForMonitor(snapshot, slot);
    return (
      <SlotBtn
        label={`M${slot}`}
        hotkey={MONITOR_HOTKEY[slot]}
        sub={s ? `G${s.gameId}` : undefined}
        active={!!s}
        variant="monitor-h"
        dataSlot={`monitor-${slot}`}
        onClick={(pos) => onMonitorClick(slot, pos)}
      />
    );
  }

  return (
    <div
      className="floor-plan"
      style={{ ["--monitor-size" as string]: `${monitorSize}px` }}
    >
      {/* Row 1: M5 T5 · T6 M6 */}
      <div className="floor-row" ref={rowRef}>
        <div className="floor-cell floor-cell--monitor">{mBtn(5)}</div>
        <div className="floor-cell floor-cell--table">{tBtn(5)}</div>
        <div className="floor-cell floor-cell--gap" />
        <div className="floor-cell floor-cell--table">{tBtn(6)}</div>
        <div className="floor-cell floor-cell--monitor">{mBtn(6)}</div>
      </div>

      {/* Row 2: M3 T3 · T4 M4 */}
      <div className="floor-row">
        <div className="floor-cell floor-cell--monitor">{mBtn(3)}</div>
        <div className="floor-cell floor-cell--table">{tBtn(3)}</div>
        <div className="floor-cell floor-cell--gap" />
        <div className="floor-cell floor-cell--table">{tBtn(4)}</div>
        <div className="floor-cell floor-cell--monitor">{mBtn(4)}</div>
      </div>

      {/* Row 3: T1 · T2 */}
      <div className="floor-row">
        <div className="floor-cell floor-cell--monitor" />
        <div className="floor-cell floor-cell--table">{tBtn(1)}</div>
        <div className="floor-cell floor-cell--gap" />
        <div className="floor-cell floor-cell--table">{tBtn(2)}</div>
        <div className="floor-cell floor-cell--monitor" />
      </div>

      {/* Row 4: M1 · M2 — T열 가운데 정렬 */}
      <div className="floor-row floor-row--mh">
        <div className="floor-cell floor-cell--monitor" />
        <div className="floor-cell floor-cell--table floor-cell--center">{mHBtn(1)}</div>
        <div className="floor-cell floor-cell--gap" />
        <div className="floor-cell floor-cell--table floor-cell--center">{mHBtn(2)}</div>
        <div className="floor-cell floor-cell--monitor" />
      </div>
    </div>
  );
}
