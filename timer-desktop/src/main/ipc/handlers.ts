import { ipcMain, app } from "electron";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { loadConfig, parseConfigInput, saveConfig } from "../config/configStore";
import { getConfiguredVenueId, verifyVenueControlPin } from "../supabase/venue";
import { YEOKSAM_VENUE_ID, isKnownVenueId } from "@mnf/venue";
import { getAllDisplaysInfo } from "../screen/displayMapper";
import { listBlindStructures } from "../supabase/blinds";
import type { TimerHub } from "../timer/timerHub";
import type { GameSession, MonitorSlot, TableSlot } from "../../shared/types";
import { isThemeSurface, normalizeSoundVolume, normalizeUiTheme, withUiThemes } from "../../shared/types";
import {
  applyTimerThemeChoice,
  deleteSavedTimerTheme,
  normalizeTimerLook,
  overlayFromTheme,
  upsertSavedTimerTheme,
  type TimerLook,
} from "../../shared/timerLook";
import {
  applyControlThemeChoice,
  deleteSavedControlTheme,
  normalizeControlLook,
  overlayFromControlTheme,
  upsertSavedControlTheme,
} from "../../shared/controlLook";
import type { BlindStructureOption, TimerAction } from "@mnf/timer/types";
import type { WindowManager } from "../windows/windowManager";
import type { RemoteServer } from "../remote/server";
import { discoverLanGames } from "../remote/lanDiscover";
import { LanViewClient } from "../remote/lanViewClient";
import type { RemoteClientMsg } from "../../shared/remote";

const CONTROL_UNREACHABLE = "컨트롤 PC에 연결할 수 없습니다. 같은 네트워크에서 컨트롤 PC를 켜 주세요.";
const HUB_WAIT_MS = 8000;
const HUB_POLL_MS = 200;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function forwardToHubOrLocal(
  remote: RemoteServer,
  msg: RemoteClientMsg,
): Promise<{ ok: true; forwarded: boolean } | { ok: false; error: string }> {
  const started = Date.now();
  while (Date.now() - started < HUB_WAIT_MS) {
    if (!remote.isYeoksamFollowerPc()) return { ok: true, forwarded: false };
    if (remote.forwardToControl(msg)) return { ok: true, forwarded: true };
    await sleep(HUB_POLL_MS);
  }
  if (!remote.isYeoksamFollowerPc()) return { ok: true, forwarded: false };
  return { ok: false, error: CONTROL_UNREACHABLE };
}

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

let volumeSaveTimer: ReturnType<typeof setTimeout> | null = null;
let lookSaveTimer: ReturnType<typeof setTimeout> | null = null;
let controlLookSaveTimer: ReturnType<typeof setTimeout> | null = null;

function persistSoundVolume(wm: WindowManager): void {
  const latest = wm.getConfig() ?? loadConfig();
  if (latest) saveConfig({ ...latest, soundVolume: wm.getSoundVolume() });
}

function persistTimerLook(wm: WindowManager, remote?: RemoteServer): void {
  const latest = wm.getConfig() ?? loadConfig();
  if (latest) saveConfig({ ...latest, timerLook: wm.getTimerLook() });
  remote?.broadcastShopTimerTheme();
}

function persistControlLook(wm: WindowManager, remote?: RemoteServer): void {
  const latest = wm.getConfig() ?? loadConfig();
  if (latest) saveConfig({ ...latest, controlLook: wm.getControlLook() });
  remote?.broadcastShopTimerTheme();
}

export function flushPendingSoundVolume(wm: WindowManager, remote?: RemoteServer): void {
  if (volumeSaveTimer) {
    clearTimeout(volumeSaveTimer);
    volumeSaveTimer = null;
    persistSoundVolume(wm);
  }
  if (lookSaveTimer) {
    clearTimeout(lookSaveTimer);
    lookSaveTimer = null;
    persistTimerLook(wm, remote);
  }
  if (controlLookSaveTimer) {
    clearTimeout(controlLookSaveTimer);
    controlLookSaveTimer = null;
    persistControlLook(wm, remote);
  }
}

let lanView: LanViewClient | null = null;

export function stopLanView(): void {
  lanView?.stop();
}

export function registerIpcHandlers(wm: WindowManager, hub: TimerHub, remote: RemoteServer): void {
  lanView = new LanViewClient(wm);
  lanView.onState((state) => {
    const win = wm.getControlWindow();
    if (win && !win.isDestroyed()) win.webContents.send("lan:view-state", state);
  });
  // ── 디스플레이 & 설정 ──────────────────────────────────────
  ipcMain.handle("displays:get", () => getAllDisplaysInfo());
  ipcMain.handle("config:get", () => wm.getConfig() ?? loadConfig());
  ipcMain.handle("config:save", async (_e, raw: unknown) => {
    const parsed = parseConfigInput(raw);
    if ("error" in parsed) return { ok: false as const, error: parsed.error };
    const saved = saveConfig(parsed.config);
    if (!saved.ok) return saved;
    remote.syncYeoksamFollow();
    await wm.applyConfig(parsed.config);
    return { ok: true as const };
  });
  ipcMain.handle("venue:set", async (_e, raw: unknown) => {
    if (!raw || typeof raw !== "object") return { ok: false as const, error: "잘못된 요청입니다." };
    const input = raw as { venueId?: unknown; pin?: unknown };
    const venueId = typeof input.venueId === "string" ? input.venueId : "";
    const pin = typeof input.pin === "string" ? input.pin : "";
    if (!isKnownVenueId(venueId)) return { ok: false as const, error: "알 수 없는 지점입니다." };
    const current = getConfiguredVenueId();
    if (venueId === current) return { ok: true as const };
    const verified = await verifyVenueControlPin(venueId, pin);
    if (!verified.ok) return { ok: false as const, error: verified.error };
    const currentCfg = wm.getConfig() ?? loadConfig();
    if (currentCfg) {
      const next = {
        ...currentCfg,
        venueId,
        controlOutputSlot: venueId === YEOKSAM_VENUE_ID ? currentCfg.controlOutputSlot : null,
      };
      const saved = saveConfig(next);
      if (!saved.ok) return saved;
      remote.syncYeoksamFollow();
      await wm.applyConfig(next);
    } else {
      remote.syncYeoksamFollow();
    }
    return { ok: true as const };
  });
  ipcMain.handle("theme:get", () => wm.getTimerTheme());
  ipcMain.handle("theme:set", async (_e, raw: unknown) => {
    const current = wm.getConfig() ?? loadConfig();
    if (!current) {
      return { ok: false as const, error: "설정이 없습니다. 모니터 설정을 먼저 완료하세요." };
    }
    let surface: "control" | "timer" = "timer";
    let themeRaw: unknown = raw;
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      const p = raw as { surface?: unknown; theme?: unknown };
      if (isThemeSurface(p.surface)) surface = p.surface;
      themeRaw = p.theme;
    }
    const theme = normalizeUiTheme(themeRaw);
    const base = { ...current, soundVolume: wm.getSoundVolume() };
    const next = surface === "control"
      ? withUiThemes(base, { controlTheme: theme })
      : applyTimerThemeChoice(base, theme);
    const saved = saveConfig(next);
    if (!saved.ok) return saved;
    await wm.applyConfig(next);
    if (surface === "timer" || surface === "control") remote.broadcastShopTimerTheme();
    return { ok: true as const, surface, theme };
  });
  ipcMain.handle("timerTheme:select", async (_e, raw: unknown) => {
    const current = wm.getConfig() ?? loadConfig();
    if (!current) {
      return { ok: false as const, error: "설정이 없습니다. 모니터 설정을 먼저 완료하세요." };
    }
    const id = typeof raw === "string" ? raw : typeof (raw as { id?: unknown })?.id === "string" ? (raw as { id: string }).id : "";
    if (!id) return { ok: false as const, error: "테마를 선택하세요." };
    const next = applyTimerThemeChoice({ ...current, soundVolume: wm.getSoundVolume() }, id);
    const saved = saveConfig(next);
    if (!saved.ok) return saved;
    await wm.applyConfig(next);
    remote.broadcastShopTimerTheme();
    return {
      ok: true as const,
      timerTheme: next.timerTheme,
      activeTimerThemeId: next.activeTimerThemeId,
      look: next.timerLook ?? null,
      savedTimerThemes: next.savedTimerThemes ?? [],
    };
  });
  ipcMain.handle("timerTheme:save", async (_e, raw: unknown) => {
    const current = wm.getConfig() ?? loadConfig();
    if (!current) {
      return { ok: false as const, error: "설정이 없습니다. 모니터 설정을 먼저 완료하세요." };
    }
    const p = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    const lookRaw = p.look !== undefined ? p.look : wm.getTimerLook();
    const look = (lookRaw ?? overlayFromTheme(wm.getTimerTheme())) as TimerLook;
    const result = upsertSavedTimerTheme(
      { ...current, soundVolume: wm.getSoundVolume() },
      {
        name: typeof p.name === "string" ? p.name : "",
        look,
        id: typeof p.id === "string" ? p.id : undefined,
        baseTheme: wm.getTimerTheme(),
      },
    );
    if (!result.ok) return result;
    const written = saveConfig(result.config);
    if (!written.ok) return written;
    await wm.applyConfig(result.config);
    remote.broadcastShopTimerTheme();
    return {
      ok: true as const,
      saved: result.saved,
      timerTheme: result.config.timerTheme,
      activeTimerThemeId: result.config.activeTimerThemeId,
      look: result.config.timerLook ?? null,
      savedTimerThemes: result.config.savedTimerThemes ?? [],
    };
  });
  ipcMain.handle("timerTheme:delete", async (_e, raw: unknown) => {
    const current = wm.getConfig() ?? loadConfig();
    if (!current) {
      return { ok: false as const, error: "설정이 없습니다. 모니터 설정을 먼저 완료하세요." };
    }
    const id = typeof raw === "string" ? raw : typeof (raw as { id?: unknown })?.id === "string" ? (raw as { id: string }).id : "";
    if (!id) return { ok: false as const, error: "삭제할 테마가 없습니다." };
    const next = deleteSavedTimerTheme({ ...current, soundVolume: wm.getSoundVolume() }, id);
    const saved = saveConfig(next);
    if (!saved.ok) return saved;
    await wm.applyConfig(next);
    remote.broadcastShopTimerTheme();
    return {
      ok: true as const,
      timerTheme: next.timerTheme,
      activeTimerThemeId: next.activeTimerThemeId,
      look: next.timerLook ?? null,
      savedTimerThemes: next.savedTimerThemes ?? [],
    };
  });
  ipcMain.handle("controlTheme:select", async (_e, raw: unknown) => {
    const current = wm.getConfig() ?? loadConfig();
    if (!current) {
      return { ok: false as const, error: "설정이 없습니다. 모니터 설정을 먼저 완료하세요." };
    }
    const id = typeof raw === "string" ? raw : typeof (raw as { id?: unknown })?.id === "string" ? (raw as { id: string }).id : "";
    if (!id) return { ok: false as const, error: "테마를 선택하세요." };
    const next = applyControlThemeChoice({ ...current, soundVolume: wm.getSoundVolume() }, id);
    const saved = saveConfig(next);
    if (!saved.ok) return saved;
    await wm.applyConfig(next);
    remote.broadcastShopTimerTheme();
    return {
      ok: true as const,
      controlTheme: next.controlTheme,
      activeControlThemeId: next.activeControlThemeId,
      look: next.controlLook ?? null,
      savedControlThemes: next.savedControlThemes ?? [],
    };
  });
  ipcMain.handle("controlTheme:save", async (_e, raw: unknown) => {
    const current = wm.getConfig() ?? loadConfig();
    if (!current) {
      return { ok: false as const, error: "설정이 없습니다. 모니터 설정을 먼저 완료하세요." };
    }
    const p = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    const lookRaw = p.look !== undefined ? p.look : wm.getControlLook();
    const look = normalizeControlLook(lookRaw, wm.getControlTheme()) ?? overlayFromControlTheme(wm.getControlTheme());
    const result = upsertSavedControlTheme(
      { ...current, soundVolume: wm.getSoundVolume() },
      {
        name: typeof p.name === "string" ? p.name : "",
        look,
        id: typeof p.id === "string" ? p.id : undefined,
        baseTheme: wm.getControlTheme(),
      },
    );
    if (!result.ok) return result;
    const written = saveConfig(result.config);
    if (!written.ok) return written;
    await wm.applyConfig(result.config);
    remote.broadcastShopTimerTheme();
    return {
      ok: true as const,
      saved: result.saved,
      controlTheme: result.config.controlTheme,
      activeControlThemeId: result.config.activeControlThemeId,
      look: result.config.controlLook ?? null,
      savedControlThemes: result.config.savedControlThemes ?? [],
    };
  });
  ipcMain.handle("controlTheme:delete", async (_e, raw: unknown) => {
    const current = wm.getConfig() ?? loadConfig();
    if (!current) {
      return { ok: false as const, error: "설정이 없습니다. 모니터 설정을 먼저 완료하세요." };
    }
    const id = typeof raw === "string" ? raw : typeof (raw as { id?: unknown })?.id === "string" ? (raw as { id: string }).id : "";
    if (!id) return { ok: false as const, error: "삭제할 테마가 없습니다." };
    const next = deleteSavedControlTheme({ ...current, soundVolume: wm.getSoundVolume() }, id);
    const saved = saveConfig(next);
    if (!saved.ok) return saved;
    await wm.applyConfig(next);
    remote.broadcastShopTimerTheme();
    return {
      ok: true as const,
      controlTheme: next.controlTheme,
      activeControlThemeId: next.activeControlThemeId,
      look: next.controlLook ?? null,
      savedControlThemes: next.savedControlThemes ?? [],
    };
  });
  ipcMain.handle("soundVolume:get", () => wm.getSoundVolume());
  ipcMain.handle("soundVolume:set", (_e, raw: unknown) => {
    const volume = normalizeSoundVolume(raw);
    wm.setSoundVolume(volume);
    const current = wm.getConfig() ?? loadConfig();
    if (current) {
      if (volumeSaveTimer) clearTimeout(volumeSaveTimer);
      volumeSaveTimer = setTimeout(() => {
        volumeSaveTimer = null;
        persistSoundVolume(wm);
      }, 400);
    }
    return { ok: true as const, volume };
  });
  ipcMain.handle("timerLook:get", () => wm.getTimerLook());
  ipcMain.handle("timerLook:set", (_e, raw: unknown) => {
    const current = wm.getConfig() ?? loadConfig();
    if (!current) {
      return { ok: false as const, error: "설정이 없습니다. 모니터 설정을 먼저 완료하세요." };
    }
    const look = raw === null ? null : normalizeTimerLook(raw, wm.getTimerTheme());
    wm.setTimerLook(look);
    if (lookSaveTimer) clearTimeout(lookSaveTimer);
    lookSaveTimer = setTimeout(() => {
      lookSaveTimer = null;
      persistTimerLook(wm, remote);
    }, 400);
    return { ok: true as const, look };
  });
  ipcMain.handle("controlLook:get", () => wm.getControlLook());
  ipcMain.handle("controlLook:set", (_e, raw: unknown) => {
    const current = wm.getConfig() ?? loadConfig();
    if (!current) {
      return { ok: false as const, error: "설정이 없습니다. 모니터 설정을 먼저 완료하세요." };
    }
    const look = raw === null ? null : normalizeControlLook(raw, wm.getControlTheme());
    wm.setControlLook(look);
    if (controlLookSaveTimer) clearTimeout(controlLookSaveTimer);
    controlLookSaveTimer = setTimeout(() => {
      controlLookSaveTimer = null;
      persistControlLook(wm, remote);
    }, 400);
    return { ok: true as const, look };
  });

  ipcMain.handle("remote:info", () => remote.getInfo());
  ipcMain.handle("remote:refreshQr", () => remote.refreshPairing());

  // ── 앱 제어 ───────────────────────────────────────────────
  ipcMain.handle("app:quit", () => {
    flushPendingSoundVolume(wm, remote);
    stopLanView();
    app.quit();
  });

  // ── 블라인드 ──────────────────────────────────────────────
  ipcMain.handle("blinds:list", async () => {
    // 5초 타임아웃: 네트워크 지연으로 IPC가 무한 대기하는 현상 방지
    const timeout = new Promise<BlindStructureOption[] | null>((resolve) =>
      setTimeout(() => resolve(null), 5000),
    );
    let remote: BlindStructureOption[] | null = null;
    try {
      remote = await Promise.race([listBlindStructures(), timeout]);
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
  ipcMain.handle("game:create", async (_e, structure: unknown) => {
    if (!isBlindStructure(structure)) return { ok: false as const, error: "블라인드 구조가 올바르지 않습니다." };
    const before = new Set(hub.getSnapshot().sessions.map((s) => s.gameId));
    const sent = await forwardToHubOrLocal(remote, { type: "peer_create_game", structure });
    if (!sent.ok) return sent;
    if (!sent.forwarded) {
      const session = hub.createGame(structure);
      return { ok: true as const, session };
    }
    const started = Date.now();
    while (Date.now() - started < HUB_WAIT_MS) {
      const added = hub.getSnapshot().sessions.find((s) => !before.has(s.gameId));
      if (added) return { ok: true as const, session: added };
      await sleep(HUB_POLL_MS);
    }
    const fallback = hub.getSnapshot().sessions.find((s) => !before.has(s.gameId))
      ?? hub.getSnapshot().sessions.at(-1);
    if (fallback) return { ok: true as const, session: fallback };
    return { ok: false as const, error: "게임을 만들었지만 아직 목록에 없습니다. 잠시 후 확인해 주세요." };
  });

  ipcMain.handle("game:delete", async (_e, gameId: unknown) => {
    if (!isGameId(gameId)) return { ok: false as const, error: "유효하지 않은 게임 ID입니다." };
    const sent = await forwardToHubOrLocal(remote, { type: "peer_deleteGame", gameId });
    if (!sent.ok) return sent;
    if (!sent.forwarded) hub.deleteGame(gameId);
    return { ok: true as const };
  });

  // ── 테이블/모니터 연결 ────────────────────────────────────
  ipcMain.handle("table:assign", async (_e, payload: unknown) => {
    const p = payload as Record<string, unknown>;
    if (!isTableSlot(p?.tableSlot)) return { ok: false as const, error: "유효하지 않은 테이블 슬롯입니다." };
    const gameId = p.gameId === null ? null : p.gameId;
    if (gameId !== null && !isGameId(gameId)) return { ok: false as const, error: "유효하지 않은 게임 ID입니다." };
    const sent = await forwardToHubOrLocal(remote, {
      type: "peer_assign_table",
      tableSlot: p.tableSlot,
      gameId: gameId as number | null,
    });
    if (!sent.ok) return sent;
    if (!sent.forwarded) hub.assignTable(p.tableSlot, gameId as number | null);
    return { ok: true as const };
  });

  ipcMain.handle("monitor:assign", async (_e, payload: unknown) => {
    const p = payload as Record<string, unknown>;
    if (!isMonitorSlot(p?.monitorSlot)) return { ok: false as const, error: "유효하지 않은 모니터 슬롯입니다." };
    const gameId = p.gameId === null ? null : p.gameId;
    if (gameId !== null && !isGameId(gameId)) return { ok: false as const, error: "유효하지 않은 게임 ID입니다." };
    const sent = await forwardToHubOrLocal(remote, {
      type: "peer_assign_monitor",
      monitorSlot: p.monitorSlot,
      gameId: gameId as number | null,
    });
    if (!sent.ok) return sent;
    if (!sent.forwarded) hub.assignMonitor(p.monitorSlot, gameId as number | null);
    return { ok: true as const };
  });
  ipcMain.handle("monitor:assign-all", async (_e, gameId: unknown) => {
    if (!isGameId(gameId)) return { ok: false as const, error: "유효하지 않은 게임 ID입니다." };
    const sent = await forwardToHubOrLocal(remote, { type: "peer_assign_all_monitors", gameId });
    if (!sent.ok) return sent;
    if (!sent.forwarded) hub.assignAllMonitors(gameId);
    return { ok: true as const };
  });
  ipcMain.handle("lan:discover", async () => {
    const games = await discoverLanGames();
    const mine = getConfiguredVenueId();
    return games.filter((g) => {
      const id = g.venueId && isKnownVenueId(g.venueId) ? g.venueId : YEOKSAM_VENUE_ID;
      return id === mine;
    });
  });
  ipcMain.handle("lan:view-start", async (_e, raw: unknown) => {
    const p = raw as Record<string, unknown>;
    const host = typeof p?.host === "string" ? p.host.trim() : "";
    const gameId = p?.gameId;
    const structureName = typeof p?.structureName === "string" ? p.structureName : "";
    if (!host || !isGameId(gameId)) return { ok: false as const, error: "연결 정보가 올바르지 않습니다." };
    wm.ensureLanDisplays();
    return lanView!.start({
      host,
      hostname: typeof p?.hostname === "string" ? p.hostname : host,
      gameId,
      structureName,
      theme: typeof p?.theme === "string" ? p.theme : undefined,
      soundVolume: typeof p?.soundVolume === "number" ? p.soundVolume : undefined,
    });
  });
  ipcMain.handle("lan:view-stop", () => {
    lanView?.stop();
    return { ok: true as const };
  });

  // ── 세션 카운터 ───────────────────────────────────────────
  ipcMain.handle("session:counters", async (_e, payload: unknown) => {
    const p = payload as Record<string, unknown>;
    if (!isGameId(p?.gameId)) return { ok: false as const, error: "유효하지 않은 게임 ID입니다." };

    let leftNotice: { html: string } | null | undefined = undefined;
    if (Object.prototype.hasOwnProperty.call(p, "leftNotice")) {
      if (p.leftNotice === null) {
        leftNotice = null;
      } else if (typeof p.leftNotice === "string") {
        const html = String(p.leftNotice)
          .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
          .replace(/\son\w+\s*=\s*(['"]).*?\1/gi, "")
          .replace(/\son\w+\s*=\s*[^\s>]+/gi, "")
          .replace(/javascript:/gi, "");
        const text = html.replace(/<[^>]+>/g, "").replace(/&nbsp;/gi, " ").replace(/\u200b/g, "").trim();
        leftNotice = text ? { html } : null;
      } else if (p.leftNotice && typeof p.leftNotice === "object" && !Array.isArray(p.leftNotice)) {
        const n = p.leftNotice as Record<string, unknown>;
        if (typeof n.html === "string") {
          const html = n.html
            .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
            .replace(/\son\w+\s*=\s*(['"]).*?\1/gi, "")
            .replace(/\son\w+\s*=\s*[^\s>]+/gi, "")
            .replace(/javascript:/gi, "");
          const text = html.replace(/<[^>]+>/g, "").replace(/&nbsp;/gi, " ").replace(/\u200b/g, "").trim();
          leftNotice = text ? { html } : null;
        }
      } else if (Array.isArray(p.leftNotice)) {
        const parts = (p.leftNotice as unknown[])
          .map((row) => {
            if (!row || typeof row !== "object") return "";
            const line = row as Record<string, unknown>;
            if (typeof line.text !== "string" || !line.text.trim()) return "";
            const size = typeof line.fontSize === "number" ? line.fontSize : 40;
            const color = typeof line.color === "string" ? line.color : "#e8e6ef";
            const escaped = line.text
              .replace(/&/g, "&amp;")
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;")
              .replace(/\n/g, "<br/>");
            return `<div style="font-size:${size}px;color:${color};text-align:center">${escaped}</div>`;
          })
          .filter(Boolean);
        leftNotice = parts.length ? { html: parts.join("") } : null;
      }
    }

    const patch: Partial<Pick<GameSession, "players" | "entries" | "rebuys" | "addon" | "bonusChip" | "leftNotice">> = {
      ...(typeof p.players === "number" ? { players: p.players } : {}),
      ...(typeof p.entries === "number" ? { entries: p.entries } : {}),
      ...(Array.isArray(p.rebuys) ? { rebuys: p.rebuys as number[] } : {}),
      ...(typeof p.addon === "number" ? { addon: p.addon } : {}),
      ...(typeof p.bonusChip === "number" ? { bonusChip: p.bonusChip } : {}),
      ...(leftNotice !== undefined ? { leftNotice } : {}),
    };
    if (remote.isYeoksamFollowerPc()) {
      const sent = await forwardToHubOrLocal(remote, { type: "peer_session_patch", gameId: p.gameId as number, patch });
      if (!sent.ok) return sent;
      if (!sent.forwarded) hub.updateSessionCounters(p.gameId as number, patch);
      return { ok: true as const };
    }
    hub.updateSessionCounters(p.gameId as number, patch);
    return { ok: true as const };
  });

  // ── 타이머 조작 ───────────────────────────────────────────
  ipcMain.handle("timer:command", async (_e, payload: unknown) => {
    const p = payload as Record<string, unknown>;
    if (!isGameId(p?.gameId)) return { ok: false as const, error: "유효하지 않은 게임 ID입니다." };
    if (!isTimerAction(p?.action)) return { ok: false as const, error: "유효하지 않은 타이머 명령입니다." };
    const sent = await forwardToHubOrLocal(remote, {
      type: "peer_timer",
      gameId: p.gameId as number,
      action: p.action as TimerAction,
      minutes: typeof p.minutes === "number" ? p.minutes : undefined,
      ms: typeof p.ms === "number" ? p.ms : undefined,
      sec: typeof p.sec === "number" ? p.sec : undefined,
    });
    if (!sent.ok) return sent;
    if (!sent.forwarded) {
      const state = hub.dispatch(p.gameId as number, p.action as TimerAction, {
        minutes: typeof p.minutes === "number" ? p.minutes : undefined,
        ms: typeof p.ms === "number" ? p.ms : undefined,
        sec: typeof p.sec === "number" ? p.sec : undefined,
      });
      if (!state) return { ok: false as const, error: "게임을 찾을 수 없습니다." };
      return { ok: true as const, state };
    }
    const started = Date.now();
    while (Date.now() - started < HUB_WAIT_MS) {
      const state = hub.getTimer(p.gameId as number);
      if (state) return { ok: true as const, state };
      await sleep(HUB_POLL_MS);
    }
    const state = hub.getTimer(p.gameId as number);
    if (!state) return { ok: false as const, error: CONTROL_UNREACHABLE };
    return { ok: true as const, state };
  });
}
