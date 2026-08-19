import { ipcMain, app } from "electron";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { loadConfig, parseConfigInput, saveConfig } from "../config/configStore";
import { getAllDisplaysInfo } from "../screen/displayMapper";
import { listBlindStructures } from "../supabase/blinds";
import type { TimerHub } from "../timer/timerHub";
import type { MonitorSlot, TableSlot } from "../../shared/types";
import type { BlindStructureOption, TimerAction } from "@mnf/timer/types";
import type { WindowManager } from "../windows/windowManager";

function localBlindsPath() {
  const dir = app.getPath("userData");
  mkdirSync(dir, { recursive: true });
  return resolve(dir, "local-blinds.json");
}

function loadLocalBlinds(): BlindStructureOption[] {
  try {
    const p = localBlindsPath();
    if (!existsSync(p)) return [];
    return JSON.parse(readFileSync(p, "utf-8")) as BlindStructureOption[];
  } catch { return []; }
}

function saveLocalBlinds(data: BlindStructureOption[]): void {
  writeFileSync(localBlindsPath(), JSON.stringify(data, null, 2), "utf-8");
}

function isMonitorSlot(v: unknown): v is MonitorSlot {
  return typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 6;
}
function isTableSlot(v: unknown): v is TableSlot {
  return typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 6;
}
function isGameId(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= 1;
}
function isTimerAction(v: unknown): v is TimerAction {
  return typeof v === "string" &&
    ["start", "pause", "stop", "levelUp", "levelDown", "reset", "setDuration", "setRemainingMs", "adjustSec"].includes(v);
}
function isBlindStructure(v: unknown): v is BlindStructureOption {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return typeof o.id === "string" && typeof o.name === "string" && Array.isArray(o.levels);
}

export function registerIpcHandlers(wm: WindowManager, hub: TimerHub): void {
  // ── 디스플레이 & 설정 ──────────────────────────────────────
  ipcMain.handle("displays:get", () => getAllDisplaysInfo());
  ipcMain.handle("config:get", () => loadConfig() ?? wm.getConfig());
  ipcMain.handle("config:save", async (_e, raw: unknown) => {
    const parsed = parseConfigInput(raw);
    if ("error" in parsed) return { ok: false as const, error: parsed.error };
    const saved = saveConfig(parsed.config);
    if (!saved.ok) return saved;
    await wm.applyConfig(parsed.config);
    return { ok: true as const };
  });

  // ── 앱 제어 ───────────────────────────────────────────────
  ipcMain.handle("app:quit", () => {
    const { app } = require("electron");
    app.quit();
  });

  // ── 블라인드 ──────────────────────────────────────────────
  ipcMain.handle("blinds:list", async () => {
    // 5초 타임아웃: 네트워크 지연으로 IPC가 무한 대기하는 현상 방지
    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000));
    let remote: Awaited<ReturnType<typeof listBlindStructures>> | null = null;
    try {
      remote = await Promise.race([listBlindStructures(), timeout]) as typeof remote;
    } catch (e) {
      console.error("[ipc] blinds:list 에러:", e);
    }
    if (remote && remote.length > 0) {
      console.log("[ipc] blinds:list 원격:", remote.length, "개");
      try { saveLocalBlinds(remote); } catch {}
      return remote;
    }
    // 원격 실패/타임아웃 → 로컬 캐시 반환
    const local = loadLocalBlinds();
    console.log("[ipc] blinds:list 로컬 fallback:", local.length, "개");
    return local;
  });
  ipcMain.handle("blinds:local:list", () => loadLocalBlinds());
  ipcMain.handle("blinds:local:save", (_e, data: unknown) => {
    if (!Array.isArray(data)) return { ok: false as const };
    saveLocalBlinds(data as BlindStructureOption[]);
    return { ok: true as const };
  });

  // ── 스냅샷 ────────────────────────────────────────────────
  ipcMain.handle("app:snapshot", () => hub.getSnapshot());
  ipcMain.handle("timer:getAll", () => hub.getAllTimers());

  // ── 게임 생성/삭제 ─────────────────────────────────────────
  ipcMain.handle("game:create", (_e, structure: unknown) => {
    if (!isBlindStructure(structure)) return { ok: false as const, error: "블라인드 구조가 올바르지 않습니다." };
    const session = hub.createGame(structure);
    return { ok: true as const, session };
  });

  ipcMain.handle("game:delete", (_e, gameId: unknown) => {
    if (!isGameId(gameId)) return { ok: false as const, error: "유효하지 않은 게임 ID입니다." };
    hub.deleteGame(gameId);
    return { ok: true as const };
  });

  // ── 테이블/모니터 연결 ────────────────────────────────────
  ipcMain.handle("table:assign", (_e, payload: unknown) => {
    const p = payload as Record<string, unknown>;
    if (!isTableSlot(p?.tableSlot)) return { ok: false as const, error: "유효하지 않은 테이블 슬롯입니다." };
    const gameId = p.gameId === null ? null : p.gameId;
    if (gameId !== null && !isGameId(gameId)) return { ok: false as const, error: "유효하지 않은 게임 ID입니다." };
    hub.assignTable(p.tableSlot, gameId as number | null);
    return { ok: true as const };
  });

  ipcMain.handle("monitor:assign", (_e, payload: unknown) => {
    const p = payload as Record<string, unknown>;
    if (!isMonitorSlot(p?.monitorSlot)) return { ok: false as const, error: "유효하지 않은 모니터 슬롯입니다." };
    const gameId = p.gameId === null ? null : p.gameId;
    if (gameId !== null && !isGameId(gameId)) return { ok: false as const, error: "유효하지 않은 게임 ID입니다." };
    hub.assignMonitor(p.monitorSlot, gameId as number | null);
    return { ok: true as const };
  });

  // ── 세션 카운터 ───────────────────────────────────────────
  ipcMain.handle("session:counters", (_e, payload: unknown) => {
    const p = payload as Record<string, unknown>;
    if (!isGameId(p?.gameId)) return { ok: false as const, error: "유효하지 않은 게임 ID입니다." };
    hub.updateSessionCounters(p.gameId as number, {
      ...(typeof p.players === "number" ? { players: p.players } : {}),
      ...(typeof p.entries === "number" ? { entries: p.entries } : {}),
      ...(Array.isArray(p.rebuys) ? { rebuys: p.rebuys as number[] } : {}),
      ...(typeof p.addon === "number" ? { addon: p.addon } : {}),
      ...(typeof p.bonusChip === "number" ? { bonusChip: p.bonusChip } : {}),
    });
    return { ok: true as const };
  });

  // ── 타이머 조작 ───────────────────────────────────────────
  ipcMain.handle("timer:command", (_e, payload: unknown) => {
    const p = payload as Record<string, unknown>;
    if (!isGameId(p?.gameId)) return { ok: false as const, error: "유효하지 않은 게임 ID입니다." };
    if (!isTimerAction(p?.action)) return { ok: false as const, error: "유효하지 않은 타이머 명령입니다." };
    const state = hub.dispatch(p.gameId as number, p.action as TimerAction, {
      minutes: typeof p.minutes === "number" ? p.minutes : undefined,
      ms: typeof p.ms === "number" ? p.ms : undefined,
      sec: typeof p.sec === "number" ? p.sec : undefined,
    });
    if (!state) return { ok: false as const, error: "게임을 찾을 수 없습니다." };
    return { ok: true as const, state };
  });
}
