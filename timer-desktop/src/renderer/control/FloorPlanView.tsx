import { type ReactNode } from "react";
import type { AppSnapshot, GameSession } from "../../shared/types";
import type { ControlLook, ControlWidgetId } from "../../shared/controlLook";
import { ControlLookWrap, FloorSlotLook, type ControlLookEdit } from "./ControlLookWrap";
import { tableLetter } from "../../shared/types";
import {
  MISA_MONITOR_HOTKEY,
  MISA_TABLE_HOTKEY,
  YEOKSAM_MONITOR_HOTKEY,
  YEOKSAM_TABLE_HOTKEY,
  isYeoksamFloor,
  monitorLabel,
} from "../../shared/floorPlan";

type Props = {
  snapshot: AppSnapshot;
  venueId: string | null | undefined;
  controlLook?: ControlLook | null;
  edit?: ControlLookEdit;
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

type SlotBtnProps = {
  label: string;
  hotkey?: string;
  sub?: string;
  active: boolean;
  variant: "table" | "table-oval" | "monitor" | "monitor-h" | "map-screen";
  dataSlot?: string;
  fontPx?: number;
  onClick: (pos: { x: number; y: number }) => void;
};

function slotFontPx(look: ControlLook | null | undefined, id: ControlWidgetId): number | undefined {
  const w = look?.overlay === true ? look.widgets[id] : undefined;
  return w?.sizeSet ? w.fontSize : undefined;
}

function SlotBtn({ label, hotkey, sub, active, variant, dataSlot, fontPx, onClick }: SlotBtnProps) {
  const labelStyle = fontPx != null ? { fontSize: `${fontPx}px` } : undefined;
  const hotkeyStyle = fontPx != null ? { fontSize: `${Math.max(8, Math.round(fontPx * 0.45))}px` } : undefined;
  return (
    <button
      type="button"
      data-slot={dataSlot}
      className={`slot-btn slot-btn--${variant}${active ? " slot-btn--active" : ""}`}
      onClick={(e) => {
        (e.currentTarget as HTMLButtonElement).blur();
        const r = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
        onClick({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
      }}
    >
      <span className="slot-btn__face">
        <span className="slot-btn__label" style={labelStyle}>{label}</span>
        {sub && <span className="slot-btn__sub">{sub}</span>}
        {hotkey && <span className="slot-btn__hotkey" style={hotkeyStyle}>{hotkey}</span>}
      </span>
    </button>
  );
}

function slotActive(
  edit: ControlLookEdit | undefined,
  id: ControlWidgetId,
  session: GameSession | undefined,
): boolean {
  return !!session || (edit?.previewOn === true && edit.selected === id);
}

function YeoksamFloorPlan({ snapshot, venueId, controlLook, edit, onTableClick, onMonitorClick }: Props) {
  function tBtn(slot: number) {
    const id = `table${slot}` as ControlWidgetId;
    const s = sessionForTable(snapshot, slot);
    const on = slotActive(edit, id, s);
    return (
      <SlotBtn
        label={tableLetter(slot)}
        hotkey={edit ? undefined : YEOKSAM_TABLE_HOTKEY[slot]}
        sub={on ? `G${s?.gameId ?? 1}` : undefined}
        active={on}
        variant="table-oval"
        dataSlot={`table-${slot}`}
        fontPx={slotFontPx(controlLook, id)}
        onClick={(pos) => onTableClick(slot, pos)}
      />
    );
  }

  function screenBtn(slot: number) {
    const id = `monitor${slot}` as ControlWidgetId;
    const s = sessionForMonitor(snapshot, slot);
    const on = slotActive(edit, id, s);
    return (
      <SlotBtn
        label={monitorLabel(venueId, slot)}
        hotkey={edit ? undefined : YEOKSAM_MONITOR_HOTKEY[slot]}
        sub={on ? `G${s?.gameId ?? 1}` : undefined}
        active={on}
        variant="map-screen"
        dataSlot={`monitor-${slot}`}
        fontPx={slotFontPx(controlLook, id)}
        onClick={(pos) => onMonitorClick(slot, pos)}
      />
    );
  }

  function node(id: ControlWidgetId, className: string, child: ReactNode) {
    return (
      <FloorSlotLook id={id} look={controlLook ?? null} edit={edit} className={className}>
        {child}
      </FloorSlotLook>
    );
  }

  return (
    <div className="floor-plan floor-plan--yeoksam">
      <div className="yeoksam-map">
        {node("monitor4", "yeoksam-node yeoksam-node--screen yeoksam-node--dt", screenBtn(4))}
        {node("table2", "yeoksam-node yeoksam-node--table yeoksam-node--b", tBtn(2))}
        {node("monitor2", "yeoksam-node yeoksam-node--screen yeoksam-node--bt", screenBtn(2))}
        {node("table4", "yeoksam-node yeoksam-node--table yeoksam-node--d", tBtn(4))}
        {node("monitor3", "yeoksam-node yeoksam-node--screen yeoksam-node--ct", screenBtn(3))}
        {node("table3", "yeoksam-node yeoksam-node--table yeoksam-node--c", tBtn(3))}
        {node("monitor1", "yeoksam-node yeoksam-node--screen yeoksam-node--bm", screenBtn(1))}
      </div>
    </div>
  );
}

/**
 * 미사점 레이아웃:
 *
 * [Et][E]
 *            [D][Dt]
 * [Ct][C]
 *            [B][Bt]
 * [At][A]
 */
function DefaultFloorPlan({ snapshot, venueId, controlLook, edit, onTableClick, onMonitorClick }: Props) {
  function slot(id: ControlWidgetId, child: ReactNode) {
    return (
      <FloorSlotLook id={id} look={controlLook ?? null} edit={edit} className="floor-slot-look--misa">
        {child}
      </FloorSlotLook>
    );
  }

  function tBtn(slot: number) {
    const id = `table${slot}` as ControlWidgetId;
    const s = sessionForTable(snapshot, slot);
    const on = slotActive(edit, id, s);
    return (
      <SlotBtn
        label={tableLetter(slot)}
        hotkey={edit ? undefined : MISA_TABLE_HOTKEY[slot]}
        sub={on ? `G${s?.gameId ?? 1}` : undefined}
        active={on}
        variant="table-oval"
        dataSlot={`table-${slot}`}
        fontPx={slotFontPx(controlLook, id)}
        onClick={(pos) => onTableClick(slot, pos)}
      />
    );
  }

  function mBtn(slot: number) {
    const id = `monitor${slot}` as ControlWidgetId;
    const s = sessionForMonitor(snapshot, slot);
    const on = slotActive(edit, id, s);
    return (
      <SlotBtn
        label={monitorLabel(venueId, slot)}
        hotkey={edit ? undefined : MISA_MONITOR_HOTKEY[slot]}
        sub={on ? `G${s?.gameId ?? 1}` : undefined}
        active={on}
        variant="monitor"
        dataSlot={`monitor-${slot}`}
        fontPx={slotFontPx(controlLook, id)}
        onClick={(pos) => onMonitorClick(slot, pos)}
      />
    );
  }

  return (
    <div className="floor-plan floor-plan--misa">
      <div className="floor-cell floor-cell--monitor misa-e-m">{slot("monitor5", mBtn(5))}</div>
      <div className="floor-cell floor-cell--table misa-e-t">{slot("table5", tBtn(5))}</div>

      <div className="floor-cell floor-cell--monitor misa-c-m">{slot("monitor3", mBtn(3))}</div>
      <div className="floor-cell floor-cell--table misa-c-t">{slot("table3", tBtn(3))}</div>

      <div className="floor-cell floor-cell--monitor misa-a-m">{slot("monitor1", mBtn(1))}</div>
      <div className="floor-cell floor-cell--table misa-a-t">{slot("table1", tBtn(1))}</div>

      <div className="floor-cell floor-cell--table misa-d-t">{slot("table4", tBtn(4))}</div>
      <div className="floor-cell floor-cell--monitor misa-d-m">{slot("monitor4", mBtn(4))}</div>

      <div className="floor-cell floor-cell--table misa-b-t">{slot("table2", tBtn(2))}</div>
      <div className="floor-cell floor-cell--monitor misa-b-m">{slot("monitor2", mBtn(2))}</div>
    </div>
  );
}

export function FloorPlanView(props: Props) {
  const inner = isYeoksamFloor(props.venueId)
    ? <YeoksamFloorPlan {...props} />
    : <DefaultFloorPlan {...props} />;
  return (
    <ControlLookWrap id="floor" look={props.controlLook ?? null} edit={props.edit} className="ctrl-look-wrap--floor">
      {inner}
    </ControlLookWrap>
  );
}
