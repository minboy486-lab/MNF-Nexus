import { BrowserWindow, screen } from "electron";
import type { AppConfig, MonitorSlot } from "../../shared/types";
import { configNeedsSetup, getDisplayMappings } from "../config/configStore";
import {
  enrichMappingsWithCurrentDisplays,
  findDisplayById,
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
    this.config = enrichMappingsWithCurrentDisplays(config);
    await this.syncWindows();
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
