import { BrowserWindow, screen } from "electron";
import type { AppConfig, GameSession, MonitorSlot, UiThemeId } from "../../shared/types";
import {
  DEFAULT_SOUND_VOLUME,
  normalizeSoundVolume,
  normalizeUiTheme,
  resolveControlTheme,
  resolveTimerTheme,
} from "../../shared/types";
import { normalizeTimerLook, normalizeSavedTimerThemes, resolveActiveTimerThemeId, shopTimerThemeEqual, shopTimerThemeFromConfig, withShopTimerTheme, type ShopTimerThemePayload, type TimerLook } from "../../shared/timerLook";
import { normalizeControlLook, normalizeSavedControlThemes, resolveActiveControlThemeId, type ControlLook } from "../../shared/controlLook";
import type { TableTimerState } from "@mnf/timer/types";
import { configNeedsSetup, getDisplayMappings } from "../config/configStore";
import {
  enrichMappingsWithCurrentDisplays,
  findDisplayById,
  getAllDisplaysInfo,
  resolveDisplayForMapping,
} from "../screen/displayMapper";
import { createControlWindow, createDisplayWindow } from "./controlWindow";
import type { TimerHub } from "../timer/timerHub";

const isDev = () =>
  process.env.NODE_ENV === "development" || Boolean(process.env.ELECTRON_RENDERER_URL);

const RECOVER_DELAY_MS = 2000;

type SetupRequiredListener = () => void;

interface DisplayWindowEntry {
  displayId: number;
  monitorSlot: MonitorSlot;
  win: BrowserWindow;
}

export class WindowManager {
  private controlWindow: BrowserWindow | null = null;
  /** displayId → entry */
  private displayWindows = new Map<number, DisplayWindowEntry>();
  private config: AppConfig | null = null;
  private soundVolume = DEFAULT_SOUND_VOLUME;
  private isQuitting = false;
  private setupRequiredListeners = new Set<SetupRequiredListener>();
  private timerHub: TimerHub | null = null;

  setTimerHub(timerHub: TimerHub): void {
    this.timerHub = timerHub;
  }

  getControlWindow(): BrowserWindow | null {
    if (this.controlWindow && !this.controlWindow.isDestroyed()) return this.controlWindow;
    return null;
  }

  /** MonitorSlot에 연결된 BrowserWindow 목록 */
  getDisplayWindowsForSlot(slot: MonitorSlot): BrowserWindow[] {
    const result: BrowserWindow[] = [];
    for (const entry of this.displayWindows.values()) {
      if (entry.monitorSlot === slot && !entry.win.isDestroyed()) {
        result.push(entry.win);
      }
    }
    return result;
  }

  getAllDisplayWindows(): BrowserWindow[] {
    const result: BrowserWindow[] = [];
    for (const entry of this.displayWindows.values()) {
      if (!entry.win.isDestroyed()) result.push(entry.win);
    }
    return result;
  }

  ensureLanDisplays(): void {
    const controlId = this.config?.controlDisplayId;
    const extras = getAllDisplaysInfo().filter((d) => d.id !== controlId);
    for (const d of extras) {
      const existing = this.displayWindows.get(d.id);
      if (existing && !existing.win.isDestroyed()) continue;
      this.openDisplayWindow(d.id, 1, d);
    }
  }

  broadcastToAllDisplays(state: TableTimerState, session: GameSession | null): void {
    for (const win of this.getAllDisplayWindows()) {
      win.webContents.send("timer:update", state);
      win.webContents.send("session:update", session);
    }
  }

  broadcastThemeToDisplays(theme: string): void {
    const next = normalizeUiTheme(theme);
    for (const win of this.getAllDisplayWindows()) {
      win.webContents.send("theme:update", next);
    }
  }

  broadcastVolumeToDisplays(volume: number): void {
    const next = normalizeSoundVolume(volume);
    for (const win of this.getAllDisplayWindows()) {
      win.webContents.send("soundVolume:update", next);
    }
  }

  restoreLocalDisplays(): void {
    const desired = this.config ? getDisplayMappings(this.config) : [];
    const desiredIds = new Set(desired.map((d) => d.displayId));
    for (const [id, entry] of this.displayWindows.entries()) {
      if (desiredIds.has(id)) continue;
      if (!entry.win.isDestroyed()) entry.win.destroy();
      this.displayWindows.delete(id);
    }
    this.broadcastTheme();
    this.broadcastTimerLook();
    this.broadcastControlLook();
    this.broadcastSoundVolume();
    this.timerHub?.pushAllMonitors();
  }

  setQuitting(value: boolean): void {
    this.isQuitting = value;
  }

  onSetupRequired(listener: SetupRequiredListener): () => void {
    this.setupRequiredListeners.add(listener);
    return () => this.setupRequiredListeners.delete(listener);
  }

  private notifySetupRequired(): void {
    for (const listener of this.setupRequiredListeners) listener();
    this.controlWindow?.webContents.send("config:setup-required");
  }

  getConfig(): AppConfig | null {
    return this.config;
  }

  async applyConfig(config: AppConfig): Promise<void> {
    const next = enrichMappingsWithCurrentDisplays({
      ...config,
      soundVolume: normalizeSoundVolume(config.soundVolume),
    });
    this.config = next;
    this.soundVolume = next.soundVolume ?? DEFAULT_SOUND_VOLUME;
    await this.syncWindows();
    this.broadcastTheme();
    this.broadcastTimerLook();
    this.broadcastControlLook();
    this.broadcastSoundVolume();
    this.timerHub?.pushAllMonitors();
    this.timerHub?.pushSnapshotToControl();
  }

  getTheme(): UiThemeId {
    return this.getTimerTheme();
  }

  getControlTheme(): UiThemeId {
    return resolveControlTheme(this.config);
  }

  getTimerTheme(): UiThemeId {
    return resolveTimerTheme(this.config);
  }

  getTimerLook(): TimerLook | null {
    return normalizeTimerLook(this.config?.timerLook, this.getTimerTheme());
  }

  getSavedTimerThemes() {
    return normalizeSavedTimerThemes(this.config?.savedTimerThemes, this.getTimerTheme());
  }

  getActiveTimerThemeId(): string {
    return resolveActiveTimerThemeId(this.config);
  }

  getControlLook(): ControlLook | null {
    return normalizeControlLook(this.config?.controlLook, this.getControlTheme());
  }

  getSavedControlThemes() {
    return normalizeSavedControlThemes(this.config?.savedControlThemes, this.getControlTheme());
  }

  getActiveControlThemeId(): string {
    return resolveActiveControlThemeId(this.config);
  }

  themesPayload() {
    return {
      controlTheme: this.getControlTheme(),
      timerTheme: this.getTimerTheme(),
      activeTimerThemeId: this.getActiveTimerThemeId(),
      savedTimerThemes: this.getSavedTimerThemes(),
      activeControlThemeId: this.getActiveControlThemeId(),
      savedControlThemes: this.getSavedControlThemes(),
    };
  }

  getShopTimerTheme(): ShopTimerThemePayload | null {
    if (!this.config) return null;
    return shopTimerThemeFromConfig(this.config);
  }

  applyShopTimerTheme(pack: ShopTimerThemePayload): boolean {
    if (!this.config) return false;
    const next = withShopTimerTheme(this.config, pack);
    if (shopTimerThemeEqual(shopTimerThemeFromConfig(this.config), shopTimerThemeFromConfig(next))) {
      return false;
    }
    this.config = next;
    this.broadcastTheme();
    this.broadcastTimerLook();
    return true;
  }

  setTimerLook(look: TimerLook | null): void {
    if (!this.config) return;
    this.config = { ...this.config, timerLook: look };
    this.broadcastTimerLook();
  }

  setControlLook(look: ControlLook | null): void {
    if (!this.config) return;
    this.config = { ...this.config, controlLook: look };
    this.broadcastControlLook();
  }

  broadcastControlLook(): void {
    const look = this.getControlLook();
    if (this.controlWindow && !this.controlWindow.isDestroyed()) {
      this.controlWindow.webContents.send("controlLook:update", look);
    }
  }

  broadcastTimerLookToDisplays(look: TimerLook | null): void {
    const next = look ? normalizeTimerLook(look, this.getTimerTheme()) : null;
    for (const win of this.getAllDisplayWindows()) {
      win.webContents.send("timerLook:update", next);
    }
  }

  broadcastTimerLook(): void {
    const look = this.getTimerLook();
    if (this.controlWindow && !this.controlWindow.isDestroyed()) {
      this.controlWindow.webContents.send("timerLook:update", look);
    }
    this.broadcastTimerLookToDisplays(look);
  }

  getSoundVolume(): number {
    return this.config
      ? normalizeSoundVolume(this.config.soundVolume)
      : this.soundVolume;
  }

  setSoundVolume(volume: number): void {
    const next = normalizeSoundVolume(volume);
    this.soundVolume = next;
    if (this.config) this.config = { ...this.config, soundVolume: next };
    this.broadcastSoundVolume();
  }

  broadcastTheme(): void {
    const timerTheme = this.getTimerTheme();
    if (this.controlWindow && !this.controlWindow.isDestroyed()) {
      this.controlWindow.webContents.send("themes:update", this.themesPayload());
    }
    for (const entry of this.displayWindows.values()) {
      if (!entry.win.isDestroyed()) {
        entry.win.webContents.send("theme:update", timerTheme);
      }
    }
  }

  broadcastSoundVolume(): void {
    const volume = this.getSoundVolume();
    if (this.controlWindow && !this.controlWindow.isDestroyed()) {
      this.controlWindow.webContents.send("soundVolume:update", volume);
    }
    for (const entry of this.displayWindows.values()) {
      if (!entry.win.isDestroyed()) {
        entry.win.webContents.send("soundVolume:update", volume);
      }
    }
  }

  async syncWindows(): Promise<void> {
    if (!this.config || configNeedsSetup(this.config)) {
      await this.ensureControlWindow();
      this.destroyDisplayWindows();
      this.notifySetupRequired();
      return;
    }
    await this.ensureControlWindow();
    await this.syncDisplayWindows();
  }

  private async ensureControlWindow(): Promise<void> {
    if (this.controlWindow && !this.controlWindow.isDestroyed()) return;

    const controlDisplayId = this.config?.controlDisplayId;
    const display =
      (controlDisplayId ? findDisplayById(controlDisplayId) : undefined) ??
      (() => {
        const pd = screen.getPrimaryDisplay();
        return {
          id: pd.id,
          label: pd.label || `Display ${pd.id}`,
          bounds: pd.bounds,
          workArea: pd.workArea,
          scaleFactor: pd.scaleFactor,
          rotation: pd.rotation,
          internal: pd.internal,
          isPrimary: true,
        };
      })();

    this.controlWindow = createControlWindow(display);
    this.controlWindow.webContents.on("did-finish-load", () => {
      this.timerHub?.pushSnapshotToControl();
      if (this.controlWindow && !this.controlWindow.isDestroyed()) {
        this.controlWindow.webContents.send("themes:update", this.themesPayload());
        this.controlWindow.webContents.send("timerLook:update", this.getTimerLook());
        this.controlWindow.webContents.send("controlLook:update", this.getControlLook());
        this.controlWindow.webContents.send("soundVolume:update", this.getSoundVolume());
      }
    });
    this.controlWindow.on("closed", () => {
      this.controlWindow = null;
      if (!this.isQuitting && !isDev()) {
        setTimeout(() => void this.ensureControlWindow(), RECOVER_DELAY_MS);
      }
    });
  }

  private destroyDisplayWindows(): void {
    for (const entry of this.displayWindows.values()) {
      if (!entry.win.isDestroyed()) entry.win.destroy();
    }
    this.displayWindows.clear();
  }

  private async syncDisplayWindows(): Promise<void> {
    if (!this.config) return;

    const desired = getDisplayMappings(this.config);
    const desiredIds = new Set(desired.map((d) => d.displayId));

    for (const [displayId, entry] of this.displayWindows.entries()) {
      if (!desiredIds.has(displayId)) {
        if (!entry.win.isDestroyed()) entry.win.destroy();
        this.displayWindows.delete(displayId);
      }
    }

    for (const mapping of desired) {
      const existing = this.displayWindows.get(mapping.displayId);
      if (existing && !existing.win.isDestroyed()) {
        if (existing.monitorSlot === mapping.monitorSlot) continue;
        if (!existing.win.isDestroyed()) existing.win.destroy();
        const current = this.displayWindows.get(mapping.displayId);
        if (current?.win === existing.win) this.displayWindows.delete(mapping.displayId);
      }

      const monitorMapping = this.config.mappings.find(
        (m) => m.displayId === mapping.displayId,
      );
      if (!monitorMapping) continue;

      const displayInfo = resolveDisplayForMapping(monitorMapping);
      if (!displayInfo) {
        this.notifySetupRequired();
        continue;
      }

      this.openDisplayWindow(mapping.displayId, mapping.monitorSlot, displayInfo);
    }
  }

  private openDisplayWindow(
    displayId: number,
    monitorSlot: MonitorSlot,
    display: Parameters<typeof createDisplayWindow>[0],
  ): void {
    const win = createDisplayWindow(display, monitorSlot);
    const entry: DisplayWindowEntry = { displayId, monitorSlot, win };
    this.displayWindows.set(displayId, entry);

    win.webContents.on("did-finish-load", () => {
      this.timerHub?.hydrateNewDisplay(monitorSlot);
      if (!win.isDestroyed()) {
        win.webContents.send("theme:update", this.getTimerTheme());
        win.webContents.send("timerLook:update", this.getTimerLook());
        win.webContents.send("soundVolume:update", this.getSoundVolume());
      }
    });

    win.on("closed", () => {
      const current = this.displayWindows.get(displayId);
      if (current?.win === win) this.displayWindows.delete(displayId);
      if (!this.isQuitting && !isDev()) {
        setTimeout(() => {
          if (!this.config || this.isQuitting) return;
          if (displayId === this.config.controlDisplayId) return;
          const mapping = this.config.mappings.find((m) => m.displayId === displayId);
          if (!mapping || !mapping.monitorSlot) return;
          const info = resolveDisplayForMapping(mapping);
          if (!info) {
            this.notifySetupRequired();
            return;
          }
          if (this.displayWindows.has(displayId)) return;
          this.openDisplayWindow(displayId, mapping.monitorSlot, info);
        }, RECOVER_DELAY_MS);
      }
    });
  }
}
