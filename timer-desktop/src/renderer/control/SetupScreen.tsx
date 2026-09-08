import { useMemo, useState } from "react";
import type { AppConfig, DisplayInfo, MonitorSlot } from "../../shared/types";
import { CONFIG_VERSION, MONITOR_SLOTS } from "../../shared/types";
import { YEOKSAM_VENUE_ID, isKnownVenueId, venueName } from "@mnf/venue";
import { YEOKSAM_SHOP_OUTPUTS, controlOutputSlotOf, isYeoksamFloor, monitorLabel, yeoksamRoleAfterSetup } from "../../shared/floorPlan";

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

function DisplayArrangeMap({ displays }: { displays: DisplayInfo[] }) {
  const layout = useMemo(() => {
    if (displays.length === 0) return null;
    const minX = Math.min(...displays.map((d) => d.bounds.x));
    const minY = Math.min(...displays.map((d) => d.bounds.y));
    const maxX = Math.max(...displays.map((d) => d.bounds.x + d.bounds.width));
    const maxY = Math.max(...displays.map((d) => d.bounds.y + d.bounds.height));
    const w = Math.max(1, maxX - minX);
    const h = Math.max(1, maxY - minY);
    return { minX, minY, w, h };
  }, [displays]);

  if (!layout) return null;

  return (
    <div className="setup-map" aria-label="디스플레이 배치">
      {displays.map((d) => {
        const left = ((d.bounds.x - layout.minX) / layout.w) * 100;
        const top = ((d.bounds.y - layout.minY) / layout.h) * 100;
        const width = (d.bounds.width / layout.w) * 100;
        const height = (d.bounds.height / layout.h) * 100;
        return (
          <div
            key={d.id}
            className={`setup-map__cell${d.isPrimary ? " setup-map__cell--primary" : ""}`}
            style={{ left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%` }}
            title={`디스플레이 ${d.osNumber}`}
          >
            <span className="setup-map__num">{d.osNumber}</span>
          </div>
        );
      })}
    </div>
  );
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
  const [identifying, setIdentifying] = useState(false);
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

  async function handleIdentify(): Promise<void> {
    setIdentifying(true);
    setError(null);
    try {
      await window.controlApi.identifyDisplays();
    } catch {
      setError("디스플레이 번호 표시에 실패했습니다.");
    } finally {
      window.setTimeout(() => setIdentifying(false), 3000);
    }
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
      controlTheme: initialConfig?.controlTheme,
      timerTheme: initialConfig?.timerTheme,
      timerLook: initialConfig?.timerLook,
      savedTimerThemes: initialConfig?.savedTimerThemes,
      activeTimerThemeId: initialConfig?.activeTimerThemeId,
      controlLook: initialConfig?.controlLook,
      savedControlThemes: initialConfig?.savedControlThemes,
      activeControlThemeId: initialConfig?.activeControlThemeId,
      soundVolume: initialConfig?.soundVolume,
      venueId,
      yeoksamRole: yeoksam
        ? yeoksamRoleAfterSetup(Boolean(controlAssigned), initialConfig?.yeoksamRole)
        : initialConfig?.yeoksamRole,
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
          ? "화면은 Bm/Bt/Ct/Dt 아무거나 지정하세요. 같은 슬롯은 어느 PC에 꽂아도 같은 게임이 나옵니다. Control(관리자)은 이 PC를 매장 허브로 둘 때 쓰면 되고, 허브 화면을 Ct로 바꿔도 허브는 유지됩니다."
          : "Control 모니터와 Display(At~Et)를 지정하세요. 번호는 Windows 디스플레이 설정과 같습니다."}
      </p>

      <div className="setup-identify-row">
        <button type="button" disabled={identifying || displays.length === 0} onClick={() => void handleIdentify()}>
          {identifying ? "번호 표시 중…" : "각 화면에 번호 띄우기"}
        </button>
        <span className="muted">Windows 디스플레이 설정의 「식별」번호와 같게 맞춥니다.</span>
      </div>

      <DisplayArrangeMap displays={displays} />

      <ul className="setup-list">
        {displays.map((d) => {
          const current = assignments[d.id] ?? "unused";
          return (
            <li key={d.id} className="setup-row">
              <div className="setup-meta setup-meta--numbered">
                <span className="setup-os-num" aria-hidden>
                  {d.osNumber}
                </span>
                <div className="setup-meta__text">
                  <strong>디스플레이 {d.osNumber}</strong>
                  <span className="muted">
                    {d.label}
                    {d.isPrimary ? " · Primary" : ""} · {d.bounds.width}×{d.bounds.height}
                  </span>
                </div>
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
                  : MONITOR_SLOTS.filter((slot) => slot <= 5).map((slot) => (
                      <option key={slot} value={`monitor-${slot}`}>
                        {monitorLabel(venueId, slot)}
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
