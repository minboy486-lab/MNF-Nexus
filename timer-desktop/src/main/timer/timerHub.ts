import type { BrowserWindow } from "electron";
import {
  applyTimerAction,
  closeTableGame,
  createInitialTimerState,
  openTableGame,
} from "@mnf/timer/engine";
import type { BlindStructureOption, TableTimerState, TimerAction } from "@mnf/timer/types";
import type { AppSnapshot, GameSession, MonitorSlot, TableSlot } from "../../shared/types";
import { MONITOR_SLOTS } from "../../shared/types";

export class TimerHub {
  /** gameId → 타이머 상태 */
  private timers = new Map<number, TableTimerState>();
  /** gameId → 세션 메타 */
  private sessions = new Map<number, GameSession>();
  /** monitorSlot → gameId */
  private monitorAssignments = new Map<MonitorSlot, number | null>();
  /** tableSlot → gameId */
  private tableAssignments = new Map<TableSlot, number | null>();

  private nextGameId = 1;
  private getDisplayWindowsForSlot: (slot: MonitorSlot) => BrowserWindow[];
  private getControlWindow: () => BrowserWindow | null;
  private autoAdvanceInterval: ReturnType<typeof setInterval> | null = null;

  constructor(deps: {
    getDisplayWindowsForSlot: (slot: MonitorSlot) => BrowserWindow[];
    getControlWindow: () => BrowserWindow | null;
  }) {
    this.getDisplayWindowsForSlot = deps.getDisplayWindowsForSlot;
    this.getControlWindow = deps.getControlWindow;
    this.startAutoAdvance();
  }

  private startAutoAdvance() {
    this.autoAdvanceInterval = setInterval(() => {
      const now = Date.now();
      let changed = false;
      for (const [gameId, state] of this.timers.entries()) {
        if (state.status !== "running" || state.endsAt === null) continue;
        if (now < state.endsAt) continue;

        // 시간 만료 → 다음 레벨로
        const next = applyTimerAction(state, "levelUp", undefined, now);
        if (next === state) {
          // 마지막 레벨 — 정지
          const stopped = applyTimerAction(state, "stop", undefined, now);
          this.timers.set(gameId, stopped);
        } else {
          this.timers.set(gameId, next);
        }
        changed = true;
        this.pushToGame(gameId);
      }
      if (changed) this.pushSnapshotToControl();
    }, 500);
  }

  destroy() {
    if (this.autoAdvanceInterval !== null) {
      clearInterval(this.autoAdvanceInterval);
      this.autoAdvanceInterval = null;
    }
  }

  // ── 게임 생성/종료 ──────────────────────────────────────────

  createGame(structure: BlindStructureOption): GameSession {
    const gameId = this.nextGameId++;
    const state = openTableGame(gameId, structure);
    this.timers.set(gameId, state);
    const rebuyCount = structure.rebuyCount ?? 0;
    const session: GameSession = {
      gameId,
      structureId: structure.id,
      structureName: structure.name,
      tableIds: [],
      isChampionship: structure.isChampionship ?? false,
      entryChip: structure.entryChip ?? 0,
      rebuyChips: structure.rebuyChips ?? Array.from({ length: rebuyCount }, () => 0),
      rebuyCount,
      hasAddon: structure.hasAddon ?? false,
      addonChip: structure.addonChip ?? 0,
      hasBonusChip: structure.hasBonusChip ?? false,
      bonusChipAmount: structure.bonusChipAmount ?? 0,
      startedAt: Date.now(),
      players: 0,
      entries: 0,
      rebuys: Array.from({ length: rebuyCount }, () => 0),
      addon: 0,
      bonusChip: 0,
    };
    this.sessions.set(gameId, session);
    this.pushSnapshotToControl();
    return session;
  }

  updateSessionCounters(
    gameId: number,
    patch: Partial<Pick<GameSession, "players" | "entries" | "rebuys" | "addon" | "bonusChip">>,
  ): void {
    const session = this.sessions.get(gameId);
    if (!session) return;
    Object.assign(session, patch);
    // 해당 게임이 할당된 모니터에도 session 업데이트 전송
    for (const [slot, gid] of this.monitorAssignments.entries()) {
      if (gid !== gameId) continue;
      const wins = this.getDisplayWindowsForSlot(slot);
      for (const win of wins) {
        if (!win.isDestroyed()) win.webContents.send("session:update", session);
      }
    }
    this.pushSnapshotToControl();
  }

  deleteGame(gameId: number): void {
    // 모니터/테이블 연결 해제
    for (const [slot, gid] of this.monitorAssignments.entries()) {
      if (gid === gameId) this.monitorAssignments.set(slot, null);
    }
    for (const [slot, gid] of this.tableAssignments.entries()) {
      if (gid === gameId) this.tableAssignments.set(slot, null);
    }
    this.timers.delete(gameId);
    this.sessions.delete(gameId);

    // 해당 모니터 창에 빈 상태 전송
    this.pushAllMonitors();
    this.pushSnapshotToControl();
  }

  // ── 테이블/모니터 연결 ─────────────────────────────────────

  assignTable(tableSlot: TableSlot, gameId: number | null): void {
    // 이전 연결 해제
    const prev = this.tableAssignments.get(tableSlot);
    if (prev !== undefined && prev !== null) {
      const session = this.sessions.get(prev);
      if (session) {
        session.tableIds = session.tableIds.filter((t) => t !== tableSlot);
      }
    }
    this.tableAssignments.set(tableSlot, gameId);
    if (gameId !== null) {
      const session = this.sessions.get(gameId);
      if (session && !session.tableIds.includes(tableSlot)) {
        session.tableIds = [...session.tableIds, tableSlot];
      }
    }
    this.pushSnapshotToControl();
  }

  assignMonitor(monitorSlot: MonitorSlot, gameId: number | null): void {
    this.monitorAssignments.set(monitorSlot, gameId);
    const wins = this.getDisplayWindowsForSlot(monitorSlot);
    const state = gameId !== null ? (this.timers.get(gameId) ?? null) : null;
    const session = gameId !== null ? (this.sessions.get(gameId) ?? null) : null;
    for (const win of wins) {
      if (!win.isDestroyed()) {
        win.webContents.send("timer:update", state ?? createInitialTimerState(0));
        win.webContents.send("session:update", session);
      }
    }
    this.pushSnapshotToControl();
  }

  // ── 타이머 조작 ────────────────────────────────────────────

  dispatch(gameId: number, action: TimerAction, options?: { minutes?: number; ms?: number; sec?: number }): TableTimerState | null {
    const current = this.timers.get(gameId);
    if (!current) return null;
    const next = applyTimerAction(current, action, options);
    this.timers.set(gameId, next);
    this.pushToGame(gameId, next);
    this.pushSnapshotToControl();
    return next;
  }

  // ── 조회 ──────────────────────────────────────────────────

  getTimer(gameId: number): TableTimerState | null {
    return this.timers.get(gameId) ?? null;
  }

  getSnapshot(): AppSnapshot {
    const sessions = Array.from(this.sessions.values());
    const monitorAssignments: Record<number, number | null> = {};
    for (const slot of MONITOR_SLOTS) {
      monitorAssignments[slot] = this.monitorAssignments.get(slot) ?? null;
    }
    const tableAssignments: Record<number, number | null> = {};
    for (let t = 1; t <= 6; t++) {
      tableAssignments[t] = this.tableAssignments.get(t as TableSlot) ?? null;
    }
    return { sessions, monitorAssignments, tableAssignments };
  }

  getAllTimers(): TableTimerState[] {
    return Array.from(this.timers.values());
  }

  // ── Push 헬퍼 ─────────────────────────────────────────────

  /** 특정 게임이 할당된 모든 모니터 창에 타이머+세션 전송 */
  pushToGame(gameId: number, state?: TableTimerState): void {
    const payload = state ?? this.timers.get(gameId);
    if (!payload) return;
    const session = this.sessions.get(gameId) ?? null;
    for (const [slot, gid] of this.monitorAssignments.entries()) {
      if (gid !== gameId) continue;
      const wins = this.getDisplayWindowsForSlot(slot);
      for (const win of wins) {
        if (!win.isDestroyed()) {
          win.webContents.send("timer:update", payload);
          win.webContents.send("session:update", session);
        }
      }
    }
  }

  pushAllMonitors(): void {
    for (const slot of MONITOR_SLOTS) {
      const gameId = this.monitorAssignments.get(slot) ?? null;
      const wins = this.getDisplayWindowsForSlot(slot);
      const state = gameId !== null ? (this.timers.get(gameId) ?? null) : null;
      const session = gameId !== null ? (this.sessions.get(gameId) ?? null) : null;
      for (const win of wins) {
        if (!win.isDestroyed()) {
          win.webContents.send("timer:update", state ?? createInitialTimerState(0));
          win.webContents.send("session:update", session);
        }
      }
    }
  }

  pushSnapshotToControl(): void {
    const win = this.getControlWindow();
    if (!win || win.isDestroyed()) return;
    win.webContents.send("app:snapshot:push", this.getSnapshot());
    win.webContents.send("timer:snapshot", this.getAllTimers());
  }

  hydrateNewDisplay(slot: MonitorSlot): void {
    const gameId = this.monitorAssignments.get(slot) ?? null;
    const wins = this.getDisplayWindowsForSlot(slot);
    const state = gameId !== null ? (this.timers.get(gameId) ?? null) : null;
    const session = gameId !== null ? (this.sessions.get(gameId) ?? null) : null;
    for (const win of wins) {
      if (!win.isDestroyed()) {
        win.webContents.send("timer:update", state ?? createInitialTimerState(0));
        win.webContents.send("session:update", session);
      }
    }
  }

  // legacy
  openGame = this.createGame.bind(this);
  closeGame(gameId: number): TableTimerState {
    const state = this.timers.get(gameId) ?? createInitialTimerState(gameId);
    this.deleteGame(gameId);
    return closeTableGame(state);
  }
  getAll = this.getAllTimers.bind(this);
}
