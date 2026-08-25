import { useMemo, useState } from "react";
import type { AppConfig, DisplayInfo } from "../../shared/types";
import { CONFIG_VERSION, MONITOR_SLOTS } from "../../shared/types";

type Props = {
  displays: DisplayInfo[];
  initialConfig: AppConfig | null;
  onSaved: (config: AppConfig) => void;
};

type AssignValue = "control" | "unused" | `monitor-${number}`;

function toAssignValue(displayId: number, controlId: number, monitorSlot: number | null): AssignValue {
  if (displayId === controlId) return "control";
  if (!monitorSlot) return "unused";
  return `monitor-${monitorSlot}`;
}

function fromAssignValue(v: AssignValue): number | null {
  if (v === "control" || v === "unused") return null;
  return Number(v.replace("monitor-", ""));
}

export function SetupScreen({ displays, initialConfig, onSaved }: Props) {
  const defaultControl =
    initialConfig?.controlDisplayId ??
    displays.find((d) => d.isPrimary)?.id ??
    displays[0]?.id ??
    0;

  const [controlId, setControlId] = useState(defaultControl);
  const [assignments, setAssignments] = useState<Record<number, AssignValue>>(() => {
    const draft: Record<number, AssignValue> = {};
    for (const d of displays) {
      const m = initialConfig?.mappings.find((m) => m.displayId === d.id);
      const slot = m?.monitorSlot ?? null;
      draft[d.id] = toAssignValue(d.id, initialConfig?.controlDisplayId ?? defaultControl, slot);
    }
    return draft;
  });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const displayCount = useMemo(
    () =>
      Object.entries(assignments).filter(
        ([id, v]) => Number(id) !== controlId && v.startsWith("monitor-"),
      ).length,
    [assignments, controlId],
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

    const config: AppConfig = {
      version: CONFIG_VERSION,
      controlDisplayId: controlId,
      theme: initialConfig?.theme,
      soundVolume: initialConfig?.soundVolume,
      mappings: displays.map((d, i) => {
        const v = assignments[d.id] ?? "unused";
        const slot = d.id === controlId ? null : fromAssignValue(v);
        return {
          displayId: d.id,
          monitorSlot: (slot ?? (i + 1)) as (typeof MONITOR_SLOTS)[number],
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
      <h2>모니터 설정</h2>
      <p className="muted">
        Control 모니터 1개와 Display 모니터(M1~M6)를 지정하세요.
        <br />같은 M번호를 여러 모니터에 지정하면 동일한 게임이 표시됩니다.
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
                {MONITOR_SLOTS.map((slot) => (
                  <option key={slot} value={`monitor-${slot}`}>M{slot} Display</option>
                ))}
              </select>
            </li>
          );
        })}
      </ul>

      <div className="setup-footer">
        <span className="muted">Display: {displayCount}개</span>
        <button type="button" className="primary" disabled={pending} onClick={() => void handleSave()}>
          {pending ? "저장 중..." : "저장"}
        </button>
      </div>
      {error && <p className="error">{error}</p>}
    </section>
  );
}
