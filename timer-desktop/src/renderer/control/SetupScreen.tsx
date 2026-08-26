import { useMemo, useState } from "react";
import type { AppConfig, DisplayInfo, MonitorSlot } from "../../shared/types";
import { CONFIG_VERSION, MONITOR_SLOTS } from "../../shared/types";
import { YEOKSAM_VENUE_ID, isKnownVenueId, venueName } from "@mnf/venue";
import { YEOKSAM_SHOP_OUTPUTS, controlOutputSlotOf, isYeoksamFloor } from "../../shared/floorPlan";

type Props = {
  displays: DisplayInfo[];
  initialConfig: AppConfig | null;
  onSaved: (config: AppConfig) => void;
  onOpenControl?: () => void;
};

type AssignValue = "control" | "unused" | `monitor-${number}`;

function fromAssignValue(v: AssignValue): number | null {
  if (v === "control" || v === "unused") return null;
  return Number(v.replace("monitor-", ""));
}

function asMonitorSlot(slot: number): MonitorSlot {
  return slot as MonitorSlot;
}

function initialAssignments(
  displays: DisplayInfo[],
  config: AppConfig | null,
  defaultControl: number,
  yeoksam: boolean,
): Record<number, AssignValue> {
  const draft: Record<number, AssignValue> = {};
  const controlId = config?.controlDisplayId ?? defaultControl;
  const outputSlot = yeoksam ? controlOutputSlotOf(config) : null;
  for (const d of displays) {
    const m = config?.mappings.find((row) => row.displayId === d.id);
    const slot = m?.monitorSlot ?? null;
    if (yeoksam) {
      if (d.id === controlId && outputSlot) {
        draft[d.id] = `monitor-${outputSlot}`;
        continue;
      }
      if (d.id === controlId) {
        draft[d.id] = "control";
        continue;
      }
      draft[d.id] = slot ? `monitor-${slot}` : "unused";
      continue;
    }
    if (d.id === controlId) draft[d.id] = "control";
    else if (!slot) draft[d.id] = "unused";
    else draft[d.id] = `monitor-${slot}`;
  }
  return draft;
}

export function SetupScreen({ displays, initialConfig, onSaved, onOpenControl }: Props) {
  const defaultControl =
    initialConfig?.controlDisplayId ??
    displays.find((d) => d.isPrimary)?.id ??
    displays[0]?.id ??
    0;

  const venueId = isKnownVenueId(initialConfig?.venueId)
    ? initialConfig.venueId
    : YEOKSAM_VENUE_ID;
  const yeoksam = isYeoksamFloor(venueId);

  const [controlId, setControlId] = useState(defaultControl);
  const [assignments, setAssignments] = useState<Record<number, AssignValue>>(() =>
    initialAssignments(displays, initialConfig, defaultControl, yeoksam),
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const displayCount = useMemo(
    () => Object.values(assignments).filter((v) => v.startsWith("monitor-")).length,
    [assignments],
  );

  function setAssignment(displayId: number, value: AssignValue): void {
    setAssignments((prev) => {
      const next = { ...prev, [displayId]: value };
      if (value === "control") {
        setControlId(displayId);
        for (const id of Object.keys(next).map(Number)) {
          if (id !== displayId && next[id] === "control") next[id] = "unused";
        }
        next[displayId] = "control";
      }
      return next;
    });
  }

  async function handleSave(): Promise<void> {
    setPending(true);
    setError(null);

    const controlAssigned = displays.find((d) => assignments[d.id] === "control");
    const hostId = yeoksam
      ? (controlAssigned?.id ?? defaultControl ?? displays[0]?.id ?? 0)
      : controlId;
    const hostSlot = fromAssignValue(assignments[hostId] ?? "unused");
    const controlOutputSlot = yeoksam && hostSlot ? asMonitorSlot(hostSlot) : null;

    const config: AppConfig = {
      version: CONFIG_VERSION,
      controlDisplayId: hostId,
      theme: initialConfig?.theme,
      soundVolume: initialConfig?.soundVolume,
      venueId,
      yeoksamRole: initialConfig?.yeoksamRole,
      controlOutputSlot,
      mappings: yeoksam
        ? displays.flatMap((d) => {
            const slot = fromAssignValue(assignments[d.id] ?? "unused");
            if (!slot) return [];
            return [
              {
                displayId: d.id,
                monitorSlot: asMonitorSlot(slot),
                gameId: null,
                label: d.label,
                bounds: d.bounds,
              },
            ];
          })
        : displays.map((d, i) => {
            const v = assignments[d.id] ?? "unused";
            const slot = d.id === hostId ? null : fromAssignValue(v);
            return {
              displayId: d.id,
              monitorSlot: asMonitorSlot(slot ?? i + 1),
              gameId: null,
              label: d.label,
              bounds: d.bounds,
            };
          }),
    };

    const result = await window.controlApi.saveConfig(config);
    if (!result.ok) {
      setError(result.error);
      setPending(false);
      return;
    }
    onSaved(config);
    setPending(false);
  }

  return (
    <section className="panel">
      <h2>모니터 설정 · {venueName(venueId)}</h2>
      <p className="muted">
        {yeoksam
          ? "이 PC 화면을 Dt·Bm 등으로 지정하세요. 지정하면 블라인드가 나오고, Esc로 이 설정, M으로 매장 컨트롤을 엽니다."
          : "Control 모니터와 Display(M1~M6)를 지정하세요."}
      </p>

      <ul className="setup-list">
        {displays.map((d) => {
          const current = assignments[d.id] ?? "unused";
          return (
            <li key={d.id} className="setup-row">
              <div className="setup-meta">
                <strong>{d.label}</strong>
                <span className="muted">
                  ID {d.id}{d.isPrimary ? " · Primary" : ""} · {d.bounds.width}×{d.bounds.height}
                </span>
              </div>
              <select
                value={current}
                onChange={(e) => setAssignment(d.id, e.target.value as AssignValue)}
              >
                <option value="control">Control (관리자)</option>
                <option value="unused">미사용</option>
                {yeoksam
                  ? YEOKSAM_SHOP_OUTPUTS.map((out) => (
                      <option key={out.slot} value={`monitor-${out.slot}`}>
                        {out.label}
                      </option>
                    ))
                  : MONITOR_SLOTS.map((slot) => (
                      <option key={slot} value={`monitor-${slot}`}>
                        M{slot} Display
                      </option>
                    ))}
              </select>
            </li>
          );
        })}
      </ul>

      <div className="setup-footer">
        <span className="muted">{yeoksam ? `송출 ${displayCount}개` : `Display: ${displayCount}개`}</span>
        {yeoksam && onOpenControl && (
          <button type="button" disabled={pending} onClick={onOpenControl}>
            매장 컨트롤
          </button>
        )}
        <button type="button" className="primary" disabled={pending} onClick={() => void handleSave()}>
          {pending ? "저장 중..." : "저장"}
        </button>
      </div>
      {error && <p className="error">{error}</p>}
    </section>
  );
}
