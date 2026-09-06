import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { app } from "electron";
import { YEOKSAM_VENUE_ID, isKnownVenueId } from "@mnf/venue";
import {
  CONFIG_VERSION,
  MONITOR_SLOTS,
  MAX_MONITORS,
  normalizeSoundVolume,
  normalizeYeoksamRole,
  resolveControlTheme,
  resolveTimerTheme,
  withUiThemes,
  type AppConfig,
  type MonitorMapping,
  type MonitorSlot,
} from "../../shared/types";
import { normalizeTimerLook, normalizeSavedTimerThemes, resolveActiveTimerThemeId } from "../../shared/timerLook";
import { normalizeControlLook, normalizeSavedControlThemes, resolveActiveControlThemeId } from "../../shared/controlLook";

function reconcileLoadedThemes(config: AppConfig): AppConfig {
  const timerTheme = resolveTimerTheme(config);
  const savedTimerThemes = normalizeSavedTimerThemes(config.savedTimerThemes, timerTheme);
  const activeTimerThemeId = resolveActiveTimerThemeId({
    ...config,
    timerTheme,
    savedTimerThemes,
  });
  const savedTimer = savedTimerThemes.find((s) => s.id === activeTimerThemeId);

  const controlTheme = resolveControlTheme(config);
  const savedControlThemes = normalizeSavedControlThemes(config.savedControlThemes, controlTheme);
  const activeControlThemeId = resolveActiveControlThemeId({
    ...config,
    controlTheme,
    savedControlThemes,
  });
  const savedControl = savedControlThemes.find((s) => s.id === activeControlThemeId);

  // 디스크의 현재 look을 유지한다. active 테마 look으로 덮으면
  // 테마 저장 후 추가 편집분이 재시작 때마다 되돌아간다.
  const timerLook =
    normalizeTimerLook(config.timerLook, timerTheme) ?? savedTimer?.look ?? null;
  const controlLook =
    normalizeControlLook(config.controlLook, controlTheme) ?? savedControl?.look ?? null;

  return {
    ...config,
    timerTheme: savedTimer?.baseTheme ?? timerTheme,
    timerLook,
    activeTimerThemeId,
    savedTimerThemes,
    controlTheme: savedControl?.baseTheme ?? controlTheme,
    controlLook,
    activeControlThemeId,
    savedControlThemes,
  };
}

export function getConfigPath(): string {
  return `${app.getPath("userData")}/config.json`;
}

function isMonitorSlot(value: number): value is MonitorSlot {
  return MONITOR_SLOTS.includes(value as MonitorSlot);
}

function normalizeMapping(raw: unknown, index: number): MonitorMapping | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Record<string, unknown>;
  const displayId = item.displayId;
  if (typeof displayId !== "number") return null;

  // monitorSlot 결정 (legacy gameNumber / monitorIndex 호환)
  let monitorSlot: MonitorSlot | null = null;
  if (typeof item.monitorSlot === "number" && isMonitorSlot(item.monitorSlot)) {
    monitorSlot = item.monitorSlot;
  } else if (typeof item.gameNumber === "number" && isMonitorSlot(item.gameNumber)) {
    monitorSlot = item.gameNumber as MonitorSlot;
  } else {
    // index 기반 fallback
    const slot = index + 1;
    monitorSlot = isMonitorSlot(slot) ? slot : null;
  }
  if (!monitorSlot) return null;

  const boundsRaw = item.bounds;
  const bounds =
    boundsRaw &&
    typeof boundsRaw === "object" &&
    typeof (boundsRaw as Record<string, unknown>).x === "number"
      ? {
          x: (boundsRaw as Record<string, number>).x,
          y: (boundsRaw as Record<string, number>).y,
          width: (boundsRaw as Record<string, number>).width,
          height: (boundsRaw as Record<string, number>).height,
        }
      : undefined;

  return {
    displayId,
    monitorSlot,
    gameId: null, // 게임 연결은 메모리에서만 관리
    label: typeof item.label === "string" ? item.label : undefined,
    bounds,
  };
}

export function validateConfig(config: AppConfig): string | null {
  if (typeof config.version !== "number" || config.version < 1) {
    return "지원하지 않는 config 버전입니다.";
  }
  if (typeof config.controlDisplayId !== "number") {
    return "controlDisplayId가 필요합니다.";
  }
  const displayCount = config.mappings.filter(
    (m) => m.displayId !== config.controlDisplayId,
  ).length;
  if (displayCount > MAX_MONITORS) {
    return `Display 모니터는 최대 ${MAX_MONITORS}개까지 지정할 수 있습니다.`;
  }
  return null;
}

export function loadConfig(): AppConfig | null {
  const path = getConfigPath();
  if (!existsSync(path)) return null;
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as AppConfig;
    if (validateConfig(parsed)) return null;
    const themed = withUiThemes(
      {
        ...parsed,
        soundVolume: normalizeSoundVolume(parsed.soundVolume),
        venueId: isKnownVenueId(parsed.venueId) ? parsed.venueId : YEOKSAM_VENUE_ID,
        yeoksamRole: normalizeYeoksamRole(parsed.yeoksamRole),
        controlOutputSlot:
          typeof parsed.controlOutputSlot === "number" && isMonitorSlot(parsed.controlOutputSlot)
            ? parsed.controlOutputSlot
            : null,
      },
      {
        controlTheme: resolveControlTheme(parsed),
        timerTheme: resolveTimerTheme(parsed),
      },
    );
    return reconcileLoadedThemes({
      ...themed,
      timerLook: normalizeTimerLook(parsed.timerLook, resolveTimerTheme(themed)),
      savedTimerThemes: normalizeSavedTimerThemes(parsed.savedTimerThemes, resolveTimerTheme(themed)),
      activeTimerThemeId: resolveActiveTimerThemeId({
        ...themed,
        savedTimerThemes: parsed.savedTimerThemes,
        activeTimerThemeId: parsed.activeTimerThemeId,
        timerLook: parsed.timerLook,
      }),
      controlLook: normalizeControlLook(parsed.controlLook, resolveControlTheme(themed)),
      savedControlThemes: normalizeSavedControlThemes(parsed.savedControlThemes, resolveControlTheme(themed)),
      activeControlThemeId: resolveActiveControlThemeId({
        ...themed,
        savedControlThemes: parsed.savedControlThemes,
        activeControlThemeId: parsed.activeControlThemeId,
        controlLook: parsed.controlLook,
      }),
    });
  } catch {
    return null;
  }
}

export function saveConfig(config: AppConfig): { ok: true } | { ok: false; error: string } {
  const error = validateConfig(config);
  if (error) return { ok: false, error };
  const path = getConfigPath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(config, null, 2), "utf8");
  return { ok: true };
}

export function parseConfigInput(raw: unknown): { config: AppConfig } | { error: string } {
  if (!raw || typeof raw !== "object") return { error: "잘못된 config 형식입니다." };
  const input = raw as Record<string, unknown>;
  const controlDisplayId = input.controlDisplayId;
  if (typeof controlDisplayId !== "number") return { error: "controlDisplayId가 필요합니다." };

  const mappingsRaw = input.mappings;
  if (!Array.isArray(mappingsRaw)) return { error: "mappings 배열이 필요합니다." };

  const mappings: MonitorMapping[] = [];
  for (let i = 0; i < mappingsRaw.length; i++) {
    const mapping = normalizeMapping(mappingsRaw[i], i);
    if (!mapping) return { error: "매핑 형식이 올바르지 않습니다." };
    mappings.push(mapping);
  }

  const existing = loadConfig();
  const soundVolume =
    input.soundVolume === undefined
      ? normalizeSoundVolume(existing?.soundVolume)
      : normalizeSoundVolume(input.soundVolume);

  const venueId = isKnownVenueId(typeof input.venueId === "string" ? input.venueId : null)
    ? (input.venueId as string)
    : isKnownVenueId(existing?.venueId ?? null)
      ? (existing?.venueId as string)
      : YEOKSAM_VENUE_ID;

  const controlOutputRaw = input.controlOutputSlot;
  const controlOutputSlot =
    typeof controlOutputRaw === "number" && isMonitorSlot(controlOutputRaw)
      ? controlOutputRaw
      : controlOutputRaw === null
        ? null
        : typeof existing?.controlOutputSlot === "number" && isMonitorSlot(existing.controlOutputSlot)
          ? existing.controlOutputSlot
          : null;

  const themeSource = {
    theme: input.theme !== undefined ? input.theme : existing?.theme,
    controlTheme: input.controlTheme !== undefined ? input.controlTheme : existing?.controlTheme,
    timerTheme: input.timerTheme !== undefined ? input.timerTheme : existing?.timerTheme,
  } as Pick<AppConfig, "theme" | "controlTheme" | "timerTheme">;

  const config: AppConfig = withUiThemes(
    {
      version: CONFIG_VERSION,
      controlDisplayId,
      mappings,
      soundVolume,
      venueId,
      yeoksamRole: normalizeYeoksamRole(
        input.yeoksamRole !== undefined ? input.yeoksamRole : existing?.yeoksamRole,
      ),
      controlOutputSlot,
    },
    {
      controlTheme: resolveControlTheme(themeSource),
      timerTheme: resolveTimerTheme(themeSource),
    },
  );
  const err = validateConfig(config);
  if (err) return { error: err };
  config.timerLook = normalizeTimerLook(
    input.timerLook !== undefined ? input.timerLook : existing?.timerLook,
    resolveTimerTheme(config),
  );
  config.savedTimerThemes = normalizeSavedTimerThemes(
    input.savedTimerThemes !== undefined ? input.savedTimerThemes : existing?.savedTimerThemes,
    resolveTimerTheme(config),
  );
  config.activeTimerThemeId = resolveActiveTimerThemeId({
    ...config,
    activeTimerThemeId:
      typeof input.activeTimerThemeId === "string"
        ? input.activeTimerThemeId
        : existing?.activeTimerThemeId,
    timerLook: config.timerLook,
  });
  config.controlLook = normalizeControlLook(
    input.controlLook !== undefined ? input.controlLook : existing?.controlLook,
    resolveControlTheme(config),
  );
  config.savedControlThemes = normalizeSavedControlThemes(
    input.savedControlThemes !== undefined ? input.savedControlThemes : existing?.savedControlThemes,
    resolveControlTheme(config),
  );
  config.activeControlThemeId = resolveActiveControlThemeId({
    ...config,
    activeControlThemeId:
      typeof input.activeControlThemeId === "string"
        ? input.activeControlThemeId
        : existing?.activeControlThemeId,
    controlLook: config.controlLook,
  });
  return { config };
}

/** Display용 모니터 매핑 목록 */
export function getDisplayMappings(
  config: AppConfig,
): Array<{ displayId: number; monitorSlot: MonitorSlot }> {
  return config.mappings
    .filter((m) => m.displayId !== config.controlDisplayId)
    .map((m) => ({ displayId: m.displayId, monitorSlot: m.monitorSlot }));
}

export function configNeedsSetup(config: AppConfig | null): boolean {
  if (!config) return true;
  if (config.controlDisplayId <= 0) return true;
  return false;
}
