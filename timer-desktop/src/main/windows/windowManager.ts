import { BrowserWindow, screen } from "electron";
import type { AppConfig, GameSession, MonitorSlot, UiThemeId } from "../../shared/types";
import { DEFAULT_SOUND_VOLUME, normalizeSoundVolume, normalizeUiTheme } from "../../shared/types";
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
    this.broadcastSoundVolume();
  }

  getTheme(): UiThemeId {
    return normalizeUiTheme(this.config?.theme);
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
    const theme = this.getTheme();
    if (this.controlWindow && !this.controlWindow.isDestroyed()) {
      this.controlWindow.webContents.send("theme:update", theme);
    }
    for (const entry of this.displayWindows.values()) {
      if (!entry.win.isDestroyed()) {
        entry.win.webContents.send("theme:update", theme);
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
        this.controlWindow.webContents.send("theme:update", this.getTheme());
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
        if (existing.monitorSlot !== mapping.monitorSlot) {
          existing.monitorSlot = mapping.monitorSlot;
          this.timerHub?.hydrateNewDisplay(mapping.monitorSlot);
        }
        continue;
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
        win.webContents.send("theme:update", this.getTheme());
        win.webContents.send("soundVolume:update", this.getSoundVolume());
      }
    });

    win.on("closed", () => {
      this.displayWindows.delete(displayId);
      if (!this.isQuitting && !isDev()) {
        setTimeout(() => {
          if (!this.config || this.isQuitting) return;
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
