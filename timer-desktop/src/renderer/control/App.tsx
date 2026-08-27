import { useCallback, useEffect, useState, type CSSProperties } from "react";
import type { BlindStructureOption, TableTimerState } from "@mnf/timer/types";
import type { AppConfig, AppSnapshot, DisplayInfo, GameSession, ThemeSurface, UiThemeId } from "../../shared/types";
import type { RemotePairingInfo } from "../../shared/remote";
import type { LanDiscoveredGame, LanViewState } from "../../shared/lanView";
import {
  applyDocumentTheme,
  DEFAULT_SOUND_VOLUME,
  DEFAULT_UI_THEME,
  normalizeSoundVolume,
  normalizeUiTheme,
  resolveControlTheme,
  resolveTimerTheme,
  tableName,
  UI_THEME_OPTIONS,
  UI_THEME_SWATCHES,
  isUiThemeId,
  withUiThemes,
} from "../../shared/types";
import { APP_VERSION, APP_VERSION_LABEL } from "../../shared/appVersion";
import {
  overlayFromTheme,
  normalizeTimerLook,
  normalizeSavedTimerThemes,
  resolveActiveTimerThemeId,
  savedThemeSwatch,
  type SavedTimerTheme,
  type TimerLook,
} from "../../shared/timerLook";
import {
  overlayFromControlTheme,
  normalizeControlLook,
  normalizeSavedControlThemes,
  resolveActiveControlThemeId,
  savedControlThemeSwatch,
  applyControlLookToDocument,
  type SavedControlTheme,
  type ControlLook,
} from "../../shared/controlLook";
import { AssignPopup } from "./AssignPopup";
import headerLogoUrl from "./mnf-logo.png";
import { BlindSelectView } from "./BlindSelectView";
import { FloorPlanView } from "./FloorPlanView";
import { controlOutputSlotOf, floorHotkeys, isYeoksamFloor, monitorLabel, yeoksamOutputGameId } from "../../shared/floorPlan";
import { GameControlView } from "./GameControlView";
import { GameListView } from "./GameListView";
import { MonitorPreviewView } from "./MonitorPreviewView";
import { SetupScreen } from "./SetupScreen";
import { TimerLookEditor } from "./TimerLookEditor";
import { ControlLookEditor } from "./ControlLookEditor";
import { ControlLookWrap } from "./ControlLookWrap";
import { playTimerVolumePreview, setTimerSoundVolume } from "../shared/timerAnnounce";
import { KNOWN_VENUES, YEOKSAM_VENUE_ID, isKnownVenueId, venueName } from "@mnf/venue";

type View =
  | { kind: "main" }
  | { kind: "blind-select" }
  | { kind: "game-control"; session: GameSession }
  | { kind: "monitor-preview"; slot: number }
  | { kind: "setup" }
  | { kind: "lan-view"; title: string }
  | { kind: "timer-look" }
  | { kind: "control-look" };

type ThemeMenu = "pick" | ThemeSurface | null;

type Popup =
  | { kind: "table"; slot: number; pos: { x: number; y: number } }
  | { kind: "monitor"; slot: number; pos: { x: number; y: number } }
  | null;

const EMPTY_SNAPSHOT: AppSnapshot = {
  sessions: [],
  monitorAssignments: {},
  tableAssignments: {},
};

export function App() {
  const [view, setView] = useState<View>({ kind: "main" });
  const [popup, setPopup] = useState<Popup>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [remoteInfo, setRemoteInfo] = useState<RemotePairingInfo | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrSrc, setQrSrc] = useState<string | null>(null);
  const [themeMenu, setThemeMenu] = useState<ThemeMenu>(null);
  const [designMenu, setDesignMenu] = useState(false);
  const [venueMenuOpen, setVenueMenuOpen] = useState(false);
  const [venuePinFor, setVenuePinFor] = useState<string | null>(null);
  const [venuePin, setVenuePin] = useState("");
  const [venuePinError, setVenuePinError] = useState<string | null>(null);
  const [venuePinPending, setVenuePinPending] = useState(false);
  const [quitConfirm, setQuitConfirm] = useState(false);
  const [lanLeaveConfirm, setLanLeaveConfirm] = useState(false);
  const [lanViewState, setLanViewState] = useState<LanViewState | null>(null);
  const [updaterStatus, setUpdaterStatus] = useState<{ status: string; version?: string; percent?: number; message?: string } | null>(null);
  const [controlTheme, setControlTheme] = useState<UiThemeId>(DEFAULT_UI_THEME);
  const [timerTheme, setTimerTheme] = useState<UiThemeId>(DEFAULT_UI_THEME);
  const [timerLook, setTimerLook] = useState<TimerLook | null>(null);
  const [savedTimerThemes, setSavedTimerThemes] = useState<SavedTimerTheme[]>([]);
  const [activeTimerThemeId, setActiveTimerThemeId] = useState<string>(DEFAULT_UI_THEME);
  const [controlLook, setControlLook] = useState<ControlLook | null>(null);
  const [savedControlThemes, setSavedControlThemes] = useState<SavedControlTheme[]>([]);
  const [activeControlThemeId, setActiveControlThemeId] = useState<string>(DEFAULT_UI_THEME);
  const [soundVolume, setSoundVolume] = useState(DEFAULT_SOUND_VOLUME);

  const [displays, setDisplays] = useState<DisplayInfo[]>([]);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [snapshot, setSnapshot] = useState<AppSnapshot>(EMPTY_SNAPSHOT);
  const [timers, setTimers] = useState<TableTimerState[]>([]);
  const [blinds, setBlinds] = useState<BlindStructureOption[]>([]);

  const [loading, setLoading] = useState(true);
  const [blindsLoading, setBlindsLoading] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, setTick] = useState(0);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [disp, cfg, snap, remote, allTimers] = await Promise.all([
        window.controlApi.getDisplays(),
        window.controlApi.getConfig(),
        window.controlApi.getSnapshot(),
        window.controlApi.getRemoteInfo().catch(() => null),
        window.controlApi.getTimers().catch(() => [] as TableTimerState[]),
      ]);
      setDisplays(disp);
      setConfig(cfg);
      setSnapshot(snap);
      setTimers(allTimers);
      if (remote) setRemoteInfo(remote);
      const nextControl = resolveControlTheme(cfg);
      const nextTimer = resolveTimerTheme(cfg);
      setControlTheme(nextControl);
      setTimerTheme(nextTimer);
      applyDocumentTheme(nextControl);
      setTimerLook(normalizeTimerLook(cfg?.timerLook, nextTimer));
      setSavedTimerThemes(normalizeSavedTimerThemes(cfg?.savedTimerThemes, nextTimer));
      setActiveTimerThemeId(resolveActiveTimerThemeId(cfg));
      setControlLook(normalizeControlLook(cfg?.controlLook, nextControl));
      setSavedControlThemes(normalizeSavedControlThemes(cfg?.savedControlThemes, nextControl));
      setActiveControlThemeId(resolveActiveControlThemeId(cfg));
      const nextVolume = normalizeSoundVolume(cfg?.soundVolume);
      setSoundVolume(nextVolume);
      setTimerSoundVolume(nextVolume);
      if (!cfg) setView({ kind: "setup" });
      else {
        const slot = controlOutputSlotOf(cfg);
        if (slot) setView({ kind: "monitor-preview", slot });
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();

    const unsubSetup = window.controlApi.onSetupRequired(() => setView({ kind: "setup" }));
    const unsubSnap = window.controlApi.onSnapshot(setSnapshot);
    const unsubTimers = window.controlApi.onTimerUpdate(setTimers);
    const unsubTimerPatch = window.controlApi.onTimerPatch((timer) => {
      setTimers((prev) => {
        const i = prev.findIndex((t) => t.tableId === timer.tableId);
        if (i < 0) return [...prev, timer];
        const next = prev.slice();
        next[i] = timer;
        return next;
      });
    });
    const unsubUpdater = window.controlApi.onUpdaterStatus(setUpdaterStatus);
    const unsubThemes = window.controlApi.onThemesUpdate((t) => {
      const nextControl = normalizeUiTheme(t.controlTheme);
      const nextTimer = normalizeUiTheme(t.timerTheme);
      setControlTheme(nextControl);
      setTimerTheme(nextTimer);
      applyDocumentTheme(nextControl);
      if (t.savedTimerThemes) {
        setSavedTimerThemes(normalizeSavedTimerThemes(t.savedTimerThemes, nextTimer));
      }
      if (t.activeTimerThemeId) setActiveTimerThemeId(t.activeTimerThemeId);
      if (t.savedControlThemes) {
        setSavedControlThemes(normalizeSavedControlThemes(t.savedControlThemes, nextControl));
      }
      if (t.activeControlThemeId) setActiveControlThemeId(t.activeControlThemeId);
    });
    const unsubVolume = window.controlApi.onSoundVolumeUpdate((v) => {
      const next = normalizeSoundVolume(v);
      setSoundVolume(next);
      setTimerSoundVolume(next);
    });
    const unsubLook = window.controlApi.onTimerLookUpdate((next) => {
      setTimerLook(normalizeTimerLook(next));
    });
    const unsubControlLook = window.controlApi.onControlLookUpdate((next) => {
      setControlLook(normalizeControlLook(next));
    });
    const unsubLan = window.controlApi.onLanViewState(setLanViewState);

    return () => {
      unsubSetup();
      unsubSnap();
      unsubTimers();
      unsubTimerPatch();
      unsubUpdater();
      unsubThemes();
      unsubVolume();
      unsubLook();
      unsubControlLook();
      unsubLan();
    };
  }, [refresh]);

  useEffect(() => {
    applyControlLookToDocument(controlLook);
  }, [controlLook]);

  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  const openRemoteQr = useCallback(async () => {
    setQrOpen(true);
    setQrLoading(true);
    try {
      const api = window.controlApi;
      const info = api.refreshRemoteQr
        ? await api.refreshRemoteQr()
        : await api.getRemoteInfo();
      setRemoteInfo(info);
    } catch (e) {
      try {
        const info = await window.controlApi.getRemoteInfo();
        setRemoteInfo(info);
      } catch {
        setError(e instanceof Error ? e.message : "QR을 만들 수 없습니다.");
      }
    } finally {
      setQrLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!qrOpen) return;
    const target = remoteInfo?.urls[0];
    if (!target) {
      setQrSrc(null);
      return;
    }
    let cancelled = false;
    void import("qrcode")
      .then(({ default: QRCode }) =>
        QRCode.toDataURL(target, {
          margin: 1,
          width: 280,
          color: { dark: "#111111", light: "#ffffff" },
        }),
      )
      .then((url) => {
        if (!cancelled) setQrSrc(url);
      })
      .catch((err) => {
        console.warn("[remote] QR 렌더 실패", err);
        if (!cancelled) setQrSrc(null);
      });
    return () => {
      cancelled = true;
    };
  }, [qrOpen, remoteInfo?.urls, remoteInfo?.punchToken]);

  const applyTimerThemeResult = useCallback(
    (result: {
      timerTheme?: UiThemeId;
      activeTimerThemeId?: string;
      look: TimerLook | null;
      savedTimerThemes: SavedTimerTheme[];
    }) => {
      const nextTimer = result.timerTheme ? normalizeUiTheme(result.timerTheme) : timerTheme;
      if (result.timerTheme) setTimerTheme(nextTimer);
      setTimerLook(result.look);
      setSavedTimerThemes(result.savedTimerThemes);
      if (result.activeTimerThemeId) setActiveTimerThemeId(result.activeTimerThemeId);
      setConfig((prev) =>
        prev
          ? {
              ...prev,
              timerTheme: nextTimer,
              activeTimerThemeId: result.activeTimerThemeId ?? prev.activeTimerThemeId,
              timerLook: result.look,
              savedTimerThemes: result.savedTimerThemes,
            }
          : prev,
      );
    },
    [timerTheme],
  );

  const handleSetTheme = useCallback(async (surface: ThemeSurface, next: UiThemeId) => {
    if (surface === "control") {
      applyDocumentTheme(next);
      setControlTheme(next);
      setConfig((prev) => (prev ? withUiThemes(prev, { controlTheme: next }) : prev));
      const result = await window.controlApi.setTheme(surface, next);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setThemeMenu(null);
      setSettingsOpen(false);
      return;
    }
    const result = await window.controlApi.selectTimerTheme(next);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    applyTimerThemeResult(result);
    setThemeMenu(null);
    setSettingsOpen(false);
  }, [applyTimerThemeResult]);

  const handleSelectTimerTheme = useCallback(async (id: string) => {
    const result = await window.controlApi.selectTimerTheme(id);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    applyTimerThemeResult(result);
    setThemeMenu(null);
    setSettingsOpen(false);
  }, [applyTimerThemeResult]);

  const handleSaveTimerTheme = useCallback(async (name: string, look: TimerLook, updateId?: string) => {
    const result = await window.controlApi.saveTimerTheme({
      name,
      look: { ...look, overlay: true },
      id: updateId,
    });
    if (!result.ok) return result;
    applyTimerThemeResult(result);
    return { ok: true as const, id: result.saved.id };
  }, [applyTimerThemeResult]);

  const handleDeleteTimerTheme = useCallback(async (id: string) => {
    const result = await window.controlApi.deleteTimerTheme(id);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    applyTimerThemeResult(result);
  }, [applyTimerThemeResult]);

  const applyControlThemeResult = useCallback(
    (result: {
      controlTheme?: UiThemeId;
      activeControlThemeId?: string;
      look: ControlLook | null;
      savedControlThemes: SavedControlTheme[];
    }) => {
      const nextControl = result.controlTheme ? normalizeUiTheme(result.controlTheme) : controlTheme;
      if (result.controlTheme) {
        setControlTheme(nextControl);
        applyDocumentTheme(nextControl);
      }
      setControlLook(result.look);
      setSavedControlThemes(result.savedControlThemes);
      if (result.activeControlThemeId) setActiveControlThemeId(result.activeControlThemeId);
      setConfig((prev) =>
        prev
          ? {
              ...prev,
              controlTheme: nextControl,
              activeControlThemeId: result.activeControlThemeId ?? prev.activeControlThemeId,
              controlLook: result.look,
              savedControlThemes: result.savedControlThemes,
            }
          : prev,
      );
    },
    [controlTheme],
  );

  const handleSelectControlTheme = useCallback(async (id: string) => {
    const result = await window.controlApi.selectControlTheme(id);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    applyControlThemeResult(result);
    setThemeMenu(null);
    setSettingsOpen(false);
    setDesignMenu(false);
  }, [applyControlThemeResult]);

  const handleSaveControlTheme = useCallback(async (name: string, look: ControlLook, updateId?: string) => {
    const result = await window.controlApi.saveControlTheme({
      name,
      look: { ...look, overlay: true },
      id: updateId,
    });
    if (!result.ok) return result;
    applyControlThemeResult(result);
    return { ok: true as const, id: result.saved.id };
  }, [applyControlThemeResult]);

  const handleDeleteControlTheme = useCallback(async (id: string) => {
    const result = await window.controlApi.deleteControlTheme(id);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    applyControlThemeResult(result);
  }, [applyControlThemeResult]);

  const closeSettings = useCallback(() => {
    setSettingsOpen(false);
    setThemeMenu(null);
    setDesignMenu(false);
    setVenueMenuOpen(false);
    setVenuePinFor(null);
    setVenuePin("");
    setVenuePinError(null);
    setVenuePinPending(false);
  }, []);

  const handleSetTimerLook = useCallback((next: TimerLook) => {
    const look = { ...next, overlay: true as const };
    setTimerLook(look);
    setConfig((prev) => (prev ? { ...prev, timerLook: look } : prev));
    void window.controlApi.setTimerLook(look);
  }, []);

  const openTimerLookEditor = useCallback(() => {
    closeSettings();
    setView({ kind: "timer-look" });
  }, [closeSettings]);

  const handleSetControlLook = useCallback((next: ControlLook) => {
    const look = { ...next, overlay: true as const };
    setControlLook(look);
    setConfig((prev) => (prev ? { ...prev, controlLook: look } : prev));
    void window.controlApi.setControlLook(look);
  }, []);

  const openControlLookEditor = useCallback(() => {
    closeSettings();
    setView({ kind: "control-look" });
  }, [closeSettings]);

  const currentVenueId = isKnownVenueId(config?.venueId) ? config.venueId : YEOKSAM_VENUE_ID;

  const handlePickVenue = useCallback((id: string) => {
    if (id === currentVenueId) {
      setVenueMenuOpen(false);
      setVenuePinFor(null);
      setVenuePin("");
      setVenuePinError(null);
      return;
    }
    setVenuePin("");
    setVenuePinError(null);
    setVenuePinFor(id);
  }, [currentVenueId]);

  const handleConfirmVenuePin = useCallback(async (pin: string) => {
    if (!venuePinFor || pin.length !== 4 || venuePinPending) return;
    setVenuePinPending(true);
    setVenuePinError(null);
    const target = venuePinFor;
    const result = await window.controlApi.setVenue({ venueId: target, pin });
    if (!result.ok) {
      setVenuePinError(result.error);
      setVenuePin("");
      setVenuePinPending(false);
      return;
    }
    if (lanViewState) {
      await window.controlApi.stopLanView();
      setLanViewState(null);
    }
    setConfig((prev) =>
      prev
        ? {
            ...prev,
            venueId: target,
            controlOutputSlot: isYeoksamFloor(target) ? prev.controlOutputSlot : null,
          }
        : prev,
    );
    closeSettings();
    setView({ kind: "main" });
  }, [venuePinFor, venuePinPending, lanViewState, closeSettings]);

  const handleSoundVolume = useCallback((raw: number) => {
    const next = normalizeSoundVolume(raw);
    setSoundVolume(next);
    setTimerSoundVolume(next);
    setConfig((prev) => (prev ? { ...prev, soundVolume: next } : prev));
    void window.controlApi.setSoundVolume(next);
  }, []);

  // ESC → 뒤로가기 / M → 선택된 모니터 미리보기
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing =
        t instanceof HTMLInputElement ||
        t instanceof HTMLTextAreaElement ||
        t?.isContentEditable === true ||
        !!t?.closest?.('[contenteditable="true"]');

      // 종료 확인 단축키
      if (quitConfirm) {
        if (e.key === "Escape" || e.key === "2" || e.key === "n" || e.key === "N") { setQuitConfirm(false); return; }
        if (e.key === "1" || e.key === "y" || e.key === "Y") { window.controlApi.quit(); return; }
        return;
      }

      if (lanLeaveConfirm) {
        if (e.key === "Escape" || e.key === "2" || e.key === "n" || e.key === "N") { setLanLeaveConfirm(false); return; }
        if (e.key === "1" || e.key === "y" || e.key === "Y") {
          setLanLeaveConfirm(false);
          void leaveLanView();
        }
        return;
      }

      if (e.key === "Escape") {
        if (qrOpen) { setQrOpen(false); return; }
        if (themeMenu === "control" || themeMenu === "timer") { setThemeMenu("pick"); return; }
        if (themeMenu === "pick") { setThemeMenu(null); return; }
        if (designMenu) { setDesignMenu(false); return; }
        if (venuePinFor) {
          setVenuePinFor(null);
          setVenuePin("");
          setVenuePinError(null);
          return;
        }
        if (venueMenuOpen) { setVenueMenuOpen(false); return; }
        if (settingsOpen) { closeSettings(); return; }
        if (popup) { setPopup(null); return; }
        if (view.kind === "timer-look") return;
        if (view.kind === "control-look") return;
        if (view.kind === "blind-select") return;
        if (view.kind === "lan-view") { setLanLeaveConfirm(true); return; }
        if (typing) return;
        if (view.kind === "monitor-preview") {
          const assigned = controlOutputSlotOf(config);
          if (assigned === view.slot) {
            setView({ kind: "setup" });
            return;
          }
          setView({ kind: "main" });
          return;
        }
        if (view.kind === "setup") {
          const assigned = controlOutputSlotOf(config);
          if (assigned) {
            setView({ kind: "monitor-preview", slot: assigned });
            return;
          }
          setView({ kind: "main" });
          return;
        }
        if (view.kind !== "main") { setView({ kind: "main" }); return; }
        setSettingsOpen(true);
        return;
      }

      if (typing) return;

      if (view.kind === "timer-look" || view.kind === "control-look") return;

      if (themeMenu === "pick") {
        if (e.key === "1") { e.preventDefault(); setThemeMenu("control"); return; }
        if (e.key === "2") { e.preventDefault(); setThemeMenu("timer"); return; }
        return;
      }

      if (designMenu) {
        if (e.key === "1") { e.preventDefault(); openControlLookEditor(); return; }
        if (e.key === "2") { e.preventDefault(); openTimerLookEditor(); return; }
        return;
      }

      // 테마 메뉴 단축키
      if (themeMenu) {
        if (themeMenu === "timer") {
          const items = [...UI_THEME_OPTIONS.map((o) => o.id), ...savedTimerThemes.map((s) => s.id)];
          const idx = parseInt(e.key, 10) - 1;
          if (idx >= 0 && idx < items.length) {
            e.preventDefault();
            void handleSelectTimerTheme(items[idx]!);
          }
          return;
        }
        const items = [...UI_THEME_OPTIONS.map((o) => o.id), ...savedControlThemes.map((s) => s.id)];
        const idx = parseInt(e.key, 10) - 1;
        if (idx >= 0 && idx < items.length) {
          e.preventDefault();
          void handleSelectControlTheme(items[idx]!);
        }
        return;
      }

      if (venuePinFor) return;

      if (venueMenuOpen) {
        const idx = parseInt(e.key, 10) - 1;
        if (idx >= 0 && idx < KNOWN_VENUES.length) {
          e.preventDefault();
          handlePickVenue(KNOWN_VENUES[idx]!.id);
        }
        return;
      }

      // 설정 메뉴 숫자 단축키
      if (settingsOpen) {
        const idx = parseInt(e.key, 10) - 1;
        if (idx === 0) {
          e.preventDefault();
          setSettingsOpen(false);
          setView({ kind: "setup" });
          return;
        }
        if (idx === 1) {
          e.preventDefault();
          setThemeMenu("pick");
          return;
        }
        if (idx === 2) {
          e.preventDefault();
          setDesignMenu(true);
          return;
        }
        if (idx === 3) {
          e.preventDefault();
          document.querySelector<HTMLButtonElement>("[data-settings-update]")?.click();
          return;
        }
        if (idx === 4) {
          e.preventDefault();
          setSettingsOpen(false);
          setQuitConfirm(true);
          return;
        }
        return;
      }

      if ((e.key === "m" || e.key === "M" || e.key === "ㅡ") && view.kind === "main") {
        // 모니터 팝업이 열려있으면 전체화면 미리보기로 전환
        if (popup?.kind === "monitor") {
          const slot = popup.slot;
          setPopup(null);
          setView({ kind: "monitor-preview", slot });
          return;
        }
        const assigned = controlOutputSlotOf(config);
        if (assigned) {
          setView({ kind: "monitor-preview", slot: assigned });
          return;
        }
      }
      // 미리보기 화면에서도 M 키로 닫기
      if ((e.key === "m" || e.key === "M" || e.key === "ㅡ") && view.kind === "monitor-preview") {
        setView({ kind: "main" });
        return;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [view, popup, settingsOpen, themeMenu, designMenu, venueMenuOpen, venuePinFor, quitConfirm, lanLeaveConfirm, qrOpen, config, handleSetTheme, handleSelectTimerTheme, handleSelectControlTheme, handlePickVenue, closeSettings, openTimerLookEditor, openControlLookEditor, savedTimerThemes, savedControlThemes]);

  // ── 플로어 단축키 (main 뷰 + 팝업 없을 때) ───────────────────
  useEffect(() => {
    // 영문 → 슬롯 매핑
    const { monitor: MONITOR_KEYS, table: TABLE_KEYS } = floorHotkeys(config?.venueId);
    const NEW_GAME_KEYS = new Set(["n", "ㅜ"]);

    // 한글 → 영문 변환표 (두벌식)
    const KO_TO_EN: Record<string, string> = {
      ㅂ:"q", ㅈ:"w", ㄷ:"e", ㄱ:"r", ㅅ:"t", ㅛ:"y", ㅕ:"u", ㅑ:"i", ㅐ:"o", ㅔ:"p",
      ㅁ:"a", ㄴ:"s", ㅇ:"d", ㄹ:"f", ㅎ:"g", ㅗ:"h", ㅓ:"j", ㅏ:"k", ㅣ:"l",
      ㅋ:"z", ㅌ:"x", ㅊ:"c", ㅍ:"v", ㅠ:"b", ㅜ:"n", ㅡ:"m",
    };

    /** 버튼 중심 좌표 반환 */
    function slotPos(selector: string): { x: number; y: number } {
      const el = document.querySelector(selector) as HTMLElement | null;
      if (el) {
        const r = el.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      }
      return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    }

    const handler = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (
        t instanceof HTMLInputElement ||
        t instanceof HTMLTextAreaElement ||
        t?.isContentEditable === true ||
        !!t?.closest?.('[contenteditable="true"]')
      ) return;
      if (view.kind !== "main") return;
      if (popup || settingsOpen || quitConfirm || lanLeaveConfirm || qrOpen || venueMenuOpen) return;

      // 한글이면 영문으로 변환
      const raw = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      const key = KO_TO_EN[raw] ?? raw;

      // 새 게임
      if (NEW_GAME_KEYS.has(key) || key === "n") {
        setView({ kind: "blind-select" });
        return;
      }

      // 게임 선택 (F1~F6)
      if (e.key.startsWith("F") && /^F[1-6]$/.test(e.key)) {
        const idx = parseInt(e.key.slice(1), 10) - 1;
        const session = snapshot.sessions[idx];
        if (session) {
          e.preventDefault();
          setView({ kind: "game-control", session });
        }
        return;
      }

      // 모니터 버튼
      if (key in MONITOR_KEYS) {
        const slot = MONITOR_KEYS[key];
        const pos = slotPos(`[data-slot="monitor-${slot}"]`);
        setPopup({ kind: "monitor", slot, pos });
        return;
      }

      // 테이블 버튼
      if (key in TABLE_KEYS) {
        const slot = TABLE_KEYS[key];
        const pos = slotPos(`[data-slot="table-${slot}"]`);
        setPopup({ kind: "table", slot, pos });
        return;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [view, popup, settingsOpen, quitConfirm, lanLeaveConfirm, qrOpen, venueMenuOpen, snapshot, config?.venueId]);

  // ── 게임 생성 ───────────────────────────────────────────────

  async function openBlindSelect(): Promise<void> {
    setBlinds([]);
    setBlindsLoading(true);
    setView({ kind: "blind-select" });

    try {
      // 로컬 캐시 먼저
      const local = await window.controlApi.listLocalBlinds();
      console.log("[App] local:", local.length);
      if (local.length > 0) {
        setBlinds(local);
        setBlindsLoading(false);
      }
    } catch (e) {
      console.error("[App] local 에러:", e);
    }

    // 원격 갱신 (6초 타임아웃)
    try {
      const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 6000));
      const list = await Promise.race([window.controlApi.listBlinds(), timeout]);
      console.log("[App] remote:", list.length);
      if (list.length > 0) setBlinds(list);
    } catch (e) {
      console.warn("[App] remote 실패/타임아웃:", e);
    } finally {
      setBlindsLoading(false);
    }
  }

  async function handleCreateGame(structure: BlindStructureOption): Promise<void> {
    setPending(true);
    setError(null);
    const result = await window.controlApi.createGame(structure);
    setPending(false);
    if (!result.ok) { setError(result.error); return; }
    setView({ kind: "game-control", session: result.session });
  }

  async function handlePickLocalGame(gameId: number): Promise<void> {
    setPending(true);
    setError(null);
    const result = await window.controlApi.assignAllMonitors(gameId);
    setPending(false);
    if (!result.ok) { setError(result.error); return; }
    setView({ kind: "main" });
  }

  async function handlePickLanGame(game: LanDiscoveredGame): Promise<void> {
    setPending(true);
    setError(null);
    const result = await window.controlApi.startLanView({
      host: game.host,
      hostname: game.hostname,
      gameId: game.gameId,
      structureName: game.structureName,
      theme: game.theme,
      soundVolume: game.soundVolume,
    });
    setPending(false);
    if (!result.ok) { setError(result.error); return; }
    setView({ kind: "lan-view", title: `${game.hostname} · G${game.gameId} ${game.structureName}` });
  }

  async function leaveLanView(): Promise<void> {
    await window.controlApi.stopLanView();
    setLanViewState(null);
    setLanLeaveConfirm(false);
    setView({ kind: "main" });
  }

  // ── 게임 삭제 ───────────────────────────────────────────────

  async function handleDeleteGame(gameId: number): Promise<void> {
    setPending(true);
    await window.controlApi.deleteGame(gameId);
    setPending(false);
    setView({ kind: "main" });
  }

  // ── 타이머 조작 ─────────────────────────────────────────────

  async function handleCommand(
    gameId: number,
    action: Parameters<typeof window.controlApi.timerCommand>[1],
    options?: { minutes?: number; ms?: number; sec?: number },
  ): Promise<void> {
    setPending(true);
    setError(null);
    const result = await window.controlApi.timerCommand(gameId, action, options);
    setPending(false);
    if (!result.ok) setError(result.error);
    else {
      setTimers((prev) => {
        const i = prev.findIndex((t) => t.tableId === result.state.tableId);
        if (i < 0) return [...prev, result.state];
        const next = prev.slice();
        next[i] = result.state;
        return next;
      });
    }
  }

  // ── 테이블/모니터 연결 ──────────────────────────────────────

  async function handleAssignTable(tableSlot: number, gameId: number | null): Promise<void> {
    await window.controlApi.assignTable(tableSlot, gameId);
    setPopup(null);
  }

  async function handleAssignMonitor(monitorSlot: number, gameId: number | null): Promise<void> {
    await window.controlApi.assignMonitor(monitorSlot, gameId);
    setPopup(null);
  }

  // ── 렌더 ────────────────────────────────────────────────────

  const currentSession =
    view.kind === "game-control"
      ? snapshot.sessions.find((s) => s.gameId === view.session.gameId) ?? view.session
      : null;

  const previewGameId =
    view.kind === "monitor-preview"
      ? isYeoksamFloor(currentVenueId)
        ? yeoksamOutputGameId(snapshot, view.slot)
        : snapshot.monitorAssignments[view.slot] ?? null
      : null;
  const previewSession =
    previewGameId != null
      ? snapshot.sessions.find((s) => s.gameId === previewGameId) ?? null
      : null;
  const previewTimer =
    previewGameId != null
      ? timers.find((t) => t.tableId === previewGameId) ?? null
      : null;

  return (
    <div className="shell compact">
      {view.kind !== "monitor-preview" && view.kind !== "lan-view" && view.kind !== "timer-look" && view.kind !== "control-look" && (
        <ControlLookWrap id="header" look={controlLook} className="ctrl-look-wrap--header">
        <header className="shell-header compact-header">
          <div className="header-brand">
            <button
              type="button"
              className="header-logo-btn"
              onClick={() => void openRemoteQr()}
              title="직원 리모컨 QR"
              aria-label="직원 리모컨 QR 생성"
            >
              <img src={headerLogoUrl} alt="MNF" className="header-logo" />
            </button>
            <span className="header-title">{venueName(currentVenueId)}</span>
            <span className="header-heading">
              <span className="header-title">
                {view.kind === "setup"
                  ? "모니터 설정"
                  : view.kind === "blind-select"
                    ? "블라인드 선택"
                    : view.kind === "game-control"
                      ? `Game ${currentSession?.gameId}`
                      : "매장 컨트롤"}
              </span>
              <span className="header-version" title={APP_VERSION}>
                {APP_VERSION_LABEL}
              </span>
            </span>
          </div>
          {view.kind === "main" && (
            <div className="header-actions">
              <button type="button" className="icon-btn" onClick={() => setSettingsOpen(true)}>
                ⚙
              </button>
            </div>
          )}
        </header>
        </ControlLookWrap>
      )}

      {loading && <p className="muted pad">불러오는 중...</p>}

      {!loading && view.kind === "main" && (
        <>
          <FloorPlanView
            snapshot={snapshot}
            venueId={currentVenueId}
            controlLook={controlLook}
            onTableClick={(slot, pos) => setPopup({ kind: "table", slot, pos })}
            onMonitorClick={(slot, pos) => setPopup({ kind: "monitor", slot, pos })}
          />
          <GameListView
            snapshot={snapshot}
            timers={timers}
            controlLook={controlLook}
            onSelectGame={(session) => setView({ kind: "game-control", session })}
            onNewGame={() => void openBlindSelect()}
          />
        </>
      )}

      {!loading && view.kind === "blind-select" && (
        <BlindSelectView
          options={blinds}
          loading={blindsLoading}
          pending={pending}
          localSessions={snapshot.sessions}
          timers={timers}
          onBack={() => setView({ kind: "main" })}
          onSelect={(s) => void handleCreateGame(s)}
          onRefresh={() => void openBlindSelect()}
          onPickLocalGame={(id) => void handlePickLocalGame(id)}
          onPickLanGame={(g) => void handlePickLanGame(g)}
        />
      )}

      {!loading && view.kind === "game-control" && currentSession && (
        <GameControlView
          session={currentSession}
          state={timers.find((t) => t.tableId === currentSession.gameId)}
          pending={pending}
          error={error}
          timerTheme={timerTheme}
          timerLook={timerLook}
          onBack={() => setView({ kind: "main" })}
          onCommand={(action, options) => void handleCommand(currentSession.gameId, action, options)}
          onDeleteGame={() => void handleDeleteGame(currentSession.gameId)}
        />
      )}

      {!loading && view.kind === "lan-view" && (
        <section className="lan-view-page">
          <button type="button" className="back-btn" onClick={() => setLanLeaveConfirm(true)}>
            ← 뒤로
          </button>
          <p className="lan-view-page__title">{view.title}</p>
          {error && <p className="error">{error}</p>}
          <MonitorPreviewView
            slot={1}
            session={lanViewState?.session ?? null}
            timerState={lanViewState?.timer ?? null}
            timerTheme={normalizeUiTheme(lanViewState?.theme ?? timerTheme)}
            timerLook={timerLook}
          />
        </section>
      )}

      {!loading && view.kind === "monitor-preview" && (
        <MonitorPreviewView
          slot={view.slot}
          session={previewSession}
          timerState={previewTimer}
          timerTheme={timerTheme}
          timerLook={timerLook}
        />
      )}

      {!loading && view.kind === "timer-look" && (
        <TimerLookEditor
          theme={timerTheme}
          look={timerLook?.overlay === true ? timerLook : overlayFromTheme(timerTheme)}
          liveOriginal={timerLook?.overlay !== true}
          savedName={savedTimerThemes.find((s) => s.id === activeTimerThemeId)?.name ?? null}
          activeSavedId={activeTimerThemeId.startsWith("saved-") ? activeTimerThemeId : null}
          savedThemes={savedTimerThemes}
          onChange={handleSetTimerLook}
          onClear={(id) => handleSelectTimerTheme(id ?? timerTheme)}
          onSaveAsTheme={handleSaveTimerTheme}
          onBack={() => setView({ kind: "main" })}
        />
      )}

      {!loading && view.kind === "control-look" && (
        <ControlLookEditor
          theme={controlTheme}
          look={controlLook?.overlay === true ? controlLook : overlayFromControlTheme(controlTheme)}
          liveOriginal={controlLook?.overlay !== true}
          savedName={savedControlThemes.find((s) => s.id === activeControlThemeId)?.name ?? null}
          activeSavedId={activeControlThemeId.startsWith("csaved-") ? activeControlThemeId : null}
          savedThemes={savedControlThemes}
          onChange={handleSetControlLook}
          onClear={(id) => handleSelectControlTheme(id ?? controlTheme)}
          onSaveAsTheme={handleSaveControlTheme}
          snapshot={snapshot}
          timers={timers}
          venueId={currentVenueId}
          onBack={() => setView({ kind: "main" })}
        />
      )}

      {!loading && view.kind === "setup" && (
        <SetupScreen
          displays={displays}
          initialConfig={config}
          onSaved={(next) => {
            setConfig(next);
            void window.controlApi.getSnapshot().then(setSnapshot);
            void window.controlApi.getTimers().then(setTimers);
            const slot = controlOutputSlotOf(next);
            setView(slot ? { kind: "monitor-preview", slot } : { kind: "main" });
          }}
          onOpenControl={() => setView({ kind: "main" })}
        />
      )}

      {popup?.kind === "table" && (
        <AssignPopup
          title={`${tableName(popup.slot)} 게임 연결`}
          mousePos={popup.pos}
          currentGameId={snapshot.tableAssignments[popup.slot] ?? null}
          sessions={snapshot.sessions}
          onSelect={(gid) => void handleAssignTable(popup.slot, gid)}
          onClose={() => setPopup(null)}
        />
      )}

      {popup?.kind === "monitor" && (
        <AssignPopup
          title={`${monitorLabel(currentVenueId, popup.slot)} 게임 연결`}
          mousePos={popup.pos}
          currentGameId={snapshot.monitorAssignments[popup.slot] ?? null}
          sessions={snapshot.sessions}
          onSelect={(gid) => void handleAssignMonitor(popup.slot, gid)}
          onClose={() => setPopup(null)}
          hint="M — 전체화면 미리보기"
        />
      )}

      {/* 전체화면 모니터 미리보기 */}

      {settingsOpen && (() => {
        const updaterLabel = (() => {
          if (!updaterStatus) return "업데이트 확인";
          if (updaterStatus.status === "checking") return "확인 중...";
          if (updaterStatus.status === "available") return `업데이트 다운로드 (v${updaterStatus.version})`;
          if (updaterStatus.status === "downloading") return `다운로드 중... ${updaterStatus.percent ?? 0}%`;
          if (updaterStatus.status === "downloaded") return `재시작하여 설치 (v${updaterStatus.version})`;
          if (updaterStatus.status === "not-available") return "최신 버전입니다 ✓";
          if (updaterStatus.status === "error") return "업데이트 오류 (재시도)";
          return "업데이트 확인";
        })();
        const updaterAction = () => {
          if (updaterStatus?.status === "available") {
            void window.controlApi.downloadUpdate();
            return;
          }
          if (updaterStatus?.status === "downloaded") {
            void window.controlApi.installUpdate();
            return;
          }
          if (updaterStatus?.status === "downloading") return;
          setUpdaterStatus({ status: "checking" });
          void window.controlApi.checkUpdate();
        };
        const controlThemeLabel =
          UI_THEME_OPTIONS.find((o) => o.id === controlTheme)?.label ?? "Black Pink";
        const activeSaved = savedTimerThemes.find((s) => s.id === activeTimerThemeId);
        const timerThemeLabel =
          activeSaved?.name ??
          UI_THEME_OPTIONS.find((o) => o.id === (isUiThemeId(activeTimerThemeId) ? activeTimerThemeId : timerTheme))
            ?.label ??
          "Black Pink";

        if (themeMenu === "pick") {
          return (
            <div
              className="settings-overlay"
              onPointerDown={(e) => {
                if (e.target === e.currentTarget) setThemeMenu(null);
              }}
            >
              <div className="settings-popup" onClick={(e) => e.stopPropagation()}>
                <h3 className="settings-popup__title">테마</h3>
                <button
                  type="button"
                  className="settings-popup__btn"
                  onClick={() => setThemeMenu("control")}
                >
                  <span className="settings-popup__num">1</span>
                  컨트롤 테마 · {controlThemeLabel}
                </button>
                <button
                  type="button"
                  className="settings-popup__btn"
                  onClick={() => setThemeMenu("timer")}
                >
                  <span className="settings-popup__num">2</span>
                  타이머 테마 · {timerThemeLabel}
                </button>
                <button
                  type="button"
                  className="settings-popup__btn settings-popup__btn--cancel"
                  onClick={() => setThemeMenu(null)}
                >
                  뒤로
                </button>
              </div>
            </div>
          );
        }

        if (themeMenu) {
          const current = themeMenu === "control" ? activeControlThemeId : activeTimerThemeId;
          const savedList = themeMenu === "control" ? savedControlThemes : savedTimerThemes;
          return (
            <div
              className="settings-overlay"
              onPointerDown={(e) => {
                if (e.target === e.currentTarget) setThemeMenu("pick");
              }}
            >
              <div className="settings-popup" onClick={(e) => e.stopPropagation()}>
                <h3 className="settings-popup__title">
                  {themeMenu === "control" ? "컨트롤 테마" : "타이머 테마"}
                </h3>
                {UI_THEME_OPTIONS.map((opt, i) => (
                  <button
                    key={opt.id}
                    type="button"
                    className={`settings-popup__btn${current === opt.id ? " settings-popup__btn--active" : ""}`}
                    onClick={() =>
                      themeMenu === "timer"
                        ? void handleSelectTimerTheme(opt.id)
                        : void handleSelectControlTheme(opt.id)
                    }
                  >
                    <span className="settings-popup__num">{i + 1}</span>
                    <span
                      className="settings-popup__swatch"
                      style={{ background: UI_THEME_SWATCHES[opt.id] }}
                      aria-hidden
                    />
                    {opt.label}
                  </button>
                ))}
                {savedList.length > 0 && (
                  <>
                    <h3 className="settings-popup__title">저장한 디자인</h3>
                    {savedList.map((opt, i) => {
                      const num = UI_THEME_OPTIONS.length + i + 1;
                      const swatch =
                        ("look" in opt
                          ? themeMenu === "control"
                            ? savedControlThemeSwatch(opt as SavedControlTheme)
                            : savedThemeSwatch(opt as SavedTimerTheme)
                          : "") || UI_THEME_SWATCHES[opt.baseTheme];
                      return (
                        <div key={opt.id} className="settings-popup__theme-row">
                          <button
                            type="button"
                            className={`settings-popup__btn${current === opt.id ? " settings-popup__btn--active" : ""}`}
                            onClick={() =>
                              themeMenu === "timer"
                                ? void handleSelectTimerTheme(opt.id)
                                : void handleSelectControlTheme(opt.id)
                            }
                          >
                            {num <= 9 ? <span className="settings-popup__num">{num}</span> : <span className="settings-popup__num">·</span>}
                            <span
                              className="settings-popup__swatch"
                              style={{ background: swatch }}
                              aria-hidden
                            />
                            {opt.name}
                          </button>
                          <button
                            type="button"
                            className="settings-popup__del"
                            title="삭제"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (themeMenu === "timer") void handleDeleteTimerTheme(opt.id);
                              else void handleDeleteControlTheme(opt.id);
                            }}
                          >
                            ×
                          </button>
                        </div>
                      );
                    })}
                  </>
                )}
                <button
                  type="button"
                  className="settings-popup__btn settings-popup__btn--cancel"
                  onClick={() => setThemeMenu("pick")}
                >
                  뒤로
                </button>
              </div>
            </div>
          );
        }

        if (designMenu) {
          return (
            <div
              className="settings-overlay"
              onPointerDown={(e) => {
                if (e.target === e.currentTarget) setDesignMenu(false);
              }}
            >
              <div className="settings-popup" onClick={(e) => e.stopPropagation()}>
                <h3 className="settings-popup__title">테마 디자인</h3>
                <button
                  type="button"
                  className="settings-popup__btn"
                  onClick={() => openControlLookEditor()}
                >
                  <span className="settings-popup__num">1</span>
                  매장화면 디자인
                </button>
                <button
                  type="button"
                  className="settings-popup__btn"
                  onClick={() => openTimerLookEditor()}
                >
                  <span className="settings-popup__num">2</span>
                  타이머 디자인
                </button>
                <button
                  type="button"
                  className="settings-popup__btn settings-popup__btn--cancel"
                  onClick={() => setDesignMenu(false)}
                >
                  뒤로
                </button>
              </div>
            </div>
          );
        }

        if (venuePinFor) {
          const pinVenueLabel = venueName(venuePinFor);
          return (
            <div
              className="settings-overlay"
              onPointerDown={(e) => {
                if (e.target === e.currentTarget) {
                  setVenuePinFor(null);
                  setVenuePin("");
                  setVenuePinError(null);
                }
              }}
            >
              <div className="settings-popup" onClick={(e) => e.stopPropagation()}>
                <h3 className="settings-popup__title">지점 비밀번호</h3>
                <p className="settings-venue-pin__hint">{pinVenueLabel} · 초기 1234</p>
                <input
                  className="settings-venue-pin__input"
                  type="password"
                  inputMode="numeric"
                  autoFocus
                  maxLength={4}
                  placeholder="4자리"
                  value={venuePin}
                  disabled={venuePinPending}
                  onChange={(e) => {
                    const next = e.currentTarget.value.replace(/\D/g, "").slice(0, 4);
                    setVenuePin(next);
                    if (next.length === 4) void handleConfirmVenuePin(next);
                  }}
                />
                {venuePinError ? <p className="settings-venue-pin__error">{venuePinError}</p> : null}
                <button
                  type="button"
                  className="settings-popup__btn settings-popup__btn--cancel"
                  onClick={() => {
                    setVenuePinFor(null);
                    setVenuePin("");
                    setVenuePinError(null);
                  }}
                >
                  뒤로
                </button>
              </div>
            </div>
          );
        }

        if (venueMenuOpen) {
          return (
            <div
              className="settings-overlay"
              onPointerDown={(e) => {
                if (e.target === e.currentTarget) setVenueMenuOpen(false);
              }}
            >
              <div className="settings-popup" onClick={(e) => e.stopPropagation()}>
                <h3 className="settings-popup__title">지점선택</h3>
                {KNOWN_VENUES.map((v, i) => (
                  <button
                    key={v.id}
                    type="button"
                    className={`settings-popup__btn${currentVenueId === v.id ? " settings-popup__btn--active" : ""}`}
                    onClick={() => handlePickVenue(v.id)}
                  >
                    <span className="settings-popup__num">{i + 1}</span>
                    {v.name}
                  </button>
                ))}
                <button
                  type="button"
                  className="settings-popup__btn settings-popup__btn--cancel"
                  onClick={() => setVenueMenuOpen(false)}
                >
                  뒤로
                </button>
              </div>
            </div>
          );
        }

        const menuItems: { label: string; variant?: string; action: () => void; update?: boolean }[] = [
          { label: "모니터 설정", action: () => { closeSettings(); setView({ kind: "setup" }); } },
          { label: "테마", action: () => { setThemeMenu("pick"); } },
          { label: "테마 디자인", action: () => { setDesignMenu(true); } },
          { label: updaterLabel, action: () => { updaterAction(); }, update: true },
          { label: "프로그램 종료", variant: "danger", action: () => { closeSettings(); setQuitConfirm(true); } },
        ];
        return (
          <div
            className="settings-overlay"
            onPointerDown={(e) => {
              if (e.target === e.currentTarget) closeSettings();
            }}
          >
            <div className="settings-popup" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
              <h3 className="settings-popup__title">설정</h3>
              <button
                type="button"
                className="settings-venue"
                onClick={() => setVenueMenuOpen(true)}
              >
                <span>지점선택</span>
                <span className="settings-volume__value">{venueName(currentVenueId)}</span>
              </button>
              {menuItems.map((item, i) => (
                <button
                  key={i}
                  type="button"
                  data-settings-update={item.update ? "" : undefined}
                  className={`settings-popup__btn${item.variant ? ` settings-popup__btn--${item.variant}` : ""}${item.update ? " settings-popup__btn--update" : ""}`}
                  onClick={item.action}
                >
                  <span className="settings-popup__num">{i + 1}</span>
                  <span className="settings-popup__btn-copy">
                    <span>{item.label}</span>
                    {item.update && updaterStatus?.status === "error" && updaterStatus.message ? (
                      <span className="settings-popup__hint">{updaterStatus.message}</span>
                    ) : null}
                  </span>
                </button>
              ))}
              <div className="settings-volume">
                <div className="settings-volume__label">
                  <span>타이머 소리</span>
                  <span className="settings-volume__value">{soundVolume}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={soundVolume}
                  className="settings-volume__slider"
                  style={{ "--vol": `${soundVolume}%` } as CSSProperties}
                  aria-label="타이머 소리"
                  onChange={(e) => handleSoundVolume(Number(e.currentTarget.value))}
                  onPointerUp={() => playTimerVolumePreview()}
                />
              </div>
              <button
                type="button"
                className="settings-popup__btn settings-popup__btn--cancel"
                onClick={() => closeSettings()}
              >
                닫기
              </button>
            </div>
          </div>
        );
      })()}

      {qrOpen && (
        <div className="settings-overlay" onClick={() => setQrOpen(false)}>
          <div className="qr-popup" onClick={(e) => e.stopPropagation()}>
            <h3 className="qr-popup__title">직원 출근 등록</h3>
            <div className="qr-popup__frame">
              {qrLoading && !qrSrc && <p className="muted">QR 생성 중...</p>}
              {qrSrc && <img src={qrSrc} alt="직원 출근 QR" className="qr-popup__img" />}
              {!qrLoading && !qrSrc && (
                <p className="error">QR을 만들지 못했습니다. 새로고침을 눌러 주세요.</p>
              )}
            </div>
            {remoteInfo && (
              <p className="qr-popup__ttl">
                {Math.max(0, Math.ceil((remoteInfo.expiresAt - Date.now()) / 1000))}초 후 만료
              </p>
            )}
            <div className="qr-popup__actions">
              <button type="button" className="settings-popup__btn" onClick={() => void openRemoteQr()}>
                QR 새로고침
              </button>
              <button
                type="button"
                className="settings-popup__btn settings-popup__btn--cancel"
                onClick={() => setQrOpen(false)}
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {lanLeaveConfirm && (
        <div className="settings-overlay">
          <div className="settings-popup">
            <h3 className="settings-popup__title">뒤로 돌아가시겠습니까?</h3>
            <div className="settings-popup__row">
              <button
                type="button"
                className="confirm-btn confirm-btn--yes"
                onClick={() => void leaveLanView()}
              >
                <span className="confirm-btn__key">1</span>
                YES
              </button>
              <button
                type="button"
                className="confirm-btn confirm-btn--no"
                onClick={() => setLanLeaveConfirm(false)}
              >
                <span className="confirm-btn__key">2</span>
                NO
              </button>
            </div>
          </div>
        </div>
      )}

      {quitConfirm && (
        <div className="settings-overlay">
          <div className="settings-popup">
            <h3 className="settings-popup__title">종료하시겠습니까?</h3>
            <div className="settings-popup__row">
              <button
                className="confirm-btn confirm-btn--yes"
                onClick={() => window.controlApi.quit()}
              >
                <span className="confirm-btn__key">1</span>
                YES
              </button>
              <button
                className="confirm-btn confirm-btn--no"
                onClick={() => setQuitConfirm(false)}
              >
                <span className="confirm-btn__key">2</span>
                NO
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
