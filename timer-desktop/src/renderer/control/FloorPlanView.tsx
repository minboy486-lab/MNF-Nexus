import { useEffect, useRef, useState } from "react";
import type { AppSnapshot, GameSession } from "../../shared/types";
import { tableLetter } from "../../shared/types";
import {
  YEOKSAM_MONITOR_HOTKEY,
  YEOKSAM_TABLE_HOTKEY,
  isYeoksamFloor,
  monitorLabel,
} from "../../shared/floorPlan";

type Props = {
  snapshot: AppSnapshot;
  venueId: string | null | undefined;
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
const TABLE_HOTKEY: Record<number, string> = { 5: "W", 3: "S", 1: "X", 6: "E", 4: "D", 2: "C" };

type SlotBtnProps = {
  label: string;
  hotkey?: string;
  sub?: string;
  active: boolean;
  variant: "table" | "table-oval" | "monitor" | "monitor-h" | "map-screen";
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
        (e.currentTarget as HTMLButtonElement).blur();
        const r = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
        onClick({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
      }}
    >
      <span className="slot-btn__face">
        <span className="slot-btn__label">{label}</span>
        {sub && <span className="slot-btn__sub">{sub}</span>}
        {hotkey && <span className="slot-btn__hotkey">{hotkey}</span>}
      </span>
    </button>
  );
}

function YeoksamFloorPlan({ snapshot, venueId, onTableClick, onMonitorClick }: Props) {
  function tBtn(slot: number) {
    const s = sessionForTable(snapshot, slot);
    return (
      <SlotBtn
        label={tableLetter(slot)}
        hotkey={YEOKSAM_TABLE_HOTKEY[slot]}
        sub={s ? `G${s.gameId}` : undefined}
        active={!!s}
        variant="table-oval"
        dataSlot={`table-${slot}`}
        onClick={(pos) => onTableClick(slot, pos)}
      />
    );
  }

  function screenBtn(slot: number) {
    const s = sessionForMonitor(snapshot, slot);
    return (
      <SlotBtn
        label={monitorLabel(venueId, slot)}
        hotkey={YEOKSAM_MONITOR_HOTKEY[slot]}
        sub={s ? `G${s.gameId}` : undefined}
        active={!!s}
        variant="map-screen"
        dataSlot={`monitor-${slot}`}
        onClick={(pos) => onMonitorClick(slot, pos)}
      />
    );
  }

  return (
    <div className="floor-plan floor-plan--yeoksam">
      <div className="yeoksam-map">
        <div className="yeoksam-node yeoksam-node--screen yeoksam-node--dt">{screenBtn(4)}</div>
        <div className="yeoksam-node yeoksam-node--table yeoksam-node--b">{tBtn(2)}</div>
        <div className="yeoksam-node yeoksam-node--screen yeoksam-node--bt">{screenBtn(2)}</div>
        <div className="yeoksam-node yeoksam-node--table yeoksam-node--d">{tBtn(4)}</div>
        <div className="yeoksam-node yeoksam-node--screen yeoksam-node--ct">{screenBtn(3)}</div>
        <div className="yeoksam-node yeoksam-node--table yeoksam-node--c">{tBtn(3)}</div>
        <div className="yeoksam-node yeoksam-node--screen yeoksam-node--bm">{screenBtn(1)}</div>
      </div>
    </div>
  );
}

/**
 * 미사점(기본) 레이아웃:
 *
 * [M5][T5]  gap  [T6][M6]
 * [M3][T3]  gap  [T4][M4]
 *     [T1]  gap  [T2]
 *      [M1]      [M2]
 */
function DefaultFloorPlan({ snapshot, onTableClick, onMonitorClick }: Omit<Props, "venueId">) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [monitorSize, setMonitorSize] = useState(68);

  useEffect(() => {
    const measure = () => {
      if (!rowRef.current) return;
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
      <div className="floor-row" ref={rowRef}>
        <div className="floor-cell floor-cell--monitor">{mBtn(5)}</div>
        <div className="floor-cell floor-cell--table">{tBtn(5)}</div>
        <div className="floor-cell floor-cell--gap" />
        <div className="floor-cell floor-cell--table">{tBtn(6)}</div>
        <div className="floor-cell floor-cell--monitor">{mBtn(6)}</div>
      </div>

      <div className="floor-row">
        <div className="floor-cell floor-cell--monitor">{mBtn(3)}</div>
        <div className="floor-cell floor-cell--table">{tBtn(3)}</div>
        <div className="floor-cell floor-cell--gap" />
        <div className="floor-cell floor-cell--table">{tBtn(4)}</div>
        <div className="floor-cell floor-cell--monitor">{mBtn(4)}</div>
      </div>

      <div className="floor-row">
        <div className="floor-cell floor-cell--monitor" />
        <div className="floor-cell floor-cell--table">{tBtn(1)}</div>
        <div className="floor-cell floor-cell--gap" />
        <div className="floor-cell floor-cell--table">{tBtn(2)}</div>
        <div className="floor-cell floor-cell--monitor" />
      </div>

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

export function FloorPlanView(props: Props) {
  if (isYeoksamFloor(props.venueId)) {
    return <YeoksamFloorPlan {...props} />;
  }
  return (
    <DefaultFloorPlan
      snapshot={props.snapshot}
      onTableClick={props.onTableClick}
      onMonitorClick={props.onMonitorClick}
    />
  );
}
