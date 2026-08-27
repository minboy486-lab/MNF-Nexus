import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import type { TableTimerState } from "@mnf/timer/types";
import { formatNextBreakRemaining, formatRemainingMs, getDisplayRemainingMs } from "@mnf/timer/engine";
import {
  formatNextPauseVal,
  formatPauseBanner,
  formatTimerLevelHeadline,
  isBreakBlind,
  resolveTimerPauseKind,
} from "@mnf/timer/levels";
import type { GameSession, UiThemeId } from "../../shared/types";
import {
  formatTotalElapsedMs,
  getSessionTotalElapsedMs,
  noticeHtmlIsEmpty,
  sanitizeNoticeHtml,
} from "../../shared/types";
import {
  lookBackground,
  lookFontSize,
  type TimerLook,
  type TimerWidgetId,
} from "../../shared/timerLook";
import { DsBlinds } from "./DsBlinds";

export type BroadcastEdit = {
  selected: TimerWidgetId | null;
  onSelect: (id: TimerWidgetId | null) => void;
  onMove: (id: TimerWidgetId, x: number, y: number) => void;
};

type Props = {
  theme: UiThemeId;
  look: TimerLook | null;
  session: GameSession | null;
  state: TableTimerState | null | undefined;
  logoUrl: string;
  idleSlot?: number;
  players?: number;
  entries?: number;
  noticeHtml?: string | null;
  onTimerClick?: (e: React.MouseEvent) => void;
  edit?: BroadcastEdit;
  className?: string;
  style?: CSSProperties;
};

export function BroadcastStage({
  theme,
  look,
  session,
  state,
  logoUrl,
  idleSlot = 1,
  players: playersProp,
  entries: entriesProp,
  noticeHtml,
  onTimerClick,
  edit,
  className = "",
  style,
}: Props) {
  const isRunning = state?.status === "running";
  const isPaused = state?.status === "paused";
  const hasGame = !!state?.blindStructureId;
  const activeLook = look?.overlay === true ? look : null;
  const remainingMs = state ? getDisplayRemainingMs(state) : 0;
  const timerText =
    !hasGame || state?.status === "stopped" ? "--:--" : formatRemainingMs(remainingMs);
  const currentLevel = state?.blindLevel ?? 1;
  const sortedLevels = state?.levels ? [...state.levels].sort((a, b) => a.level - b.level) : [];
  const currentIdx = sortedLevels.findIndex((l) => l.level === currentLevel);
  const nextLevel = currentIdx >= 0 ? (sortedLevels[currentIdx + 1] ?? null) : null;
  const isBreakLevel =
    (state?.bigBlind ?? -1) === 0 && (state?.smallBlind ?? -1) === 0 && !!state?.blindStructureId;
  const pauseKind = resolveTimerPauseKind(state);
  const players = playersProp ?? session?.players ?? 0;
  const entries = entriesProp ?? session?.entries ?? 0;
  const totalRebuy = session ? session.rebuys.reduce((a, b) => a + b, 0) : 0;
  const totalChip = session
    ? session.entries * session.entryChip +
      session.rebuys.reduce((sum, cnt, i) => sum + cnt * (session.rebuyChips[i] ?? 0), 0) +
      session.addon * session.addonChip +
      session.bonusChip * session.bonusChipAmount
    : 0;
  const avgChip = session && players > 0 ? Math.round(totalChip / players) : 0;
  const totalTimeText = session?.startedAt
    ? formatTotalElapsedMs(getSessionTotalElapsedMs(session))
    : "—";
  const nextBreakText = formatNextBreakRemaining(state?.levels, currentLevel, remainingMs);
  const notice =
    noticeHtml !== undefined
      ? noticeHtml
      : session?.leftNotice && !noticeHtmlIsEmpty(session.leftNotice.html)
        ? session.leftNotice.html
        : null;
  const showNotice = !!notice && !noticeHtmlIsEmpty(notice);

  const statusClass = `${isRunning ? " ds--running" : ""}${isPaused ? " ds--paused" : ""}${!hasGame ? " ds--idle" : ""}`;
  const bgStyle: CSSProperties | undefined =
    activeLook?.bgSet ? { ...style, background: lookBackground(activeLook) } : style;

  const tw = activeLook?.widgets.timer;
  const timerColorSet = tw?.colorSet === true;
  const useGrad = isRunning && timerColorSet && !!tw?.color2;
  const timerStyle: CSSProperties | undefined = timerColorSet
    ? useGrad
      ? {
          color: "transparent",
          backgroundImage: `linear-gradient(180deg, ${tw.color} 0%, ${tw.color2} 100%)`,
          backgroundClip: "text",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          filter: "none",
          textShadow: "none",
        }
      : { color: tw.color, WebkitTextFillColor: tw.color }
    : undefined;

  const nextBlock = nextLevel ? (
    isBreakBlind(nextLevel) ? (
      <>
        <span className="ds-next__label">NEXT</span>
        <span className="ds-next__val">{formatNextPauseVal(nextLevel)}</span>
      </>
    ) : (
      <>
        <span className="ds-next__label">NEXT LV.{nextLevel.level}</span>
        <span className="ds-next__val">
          {nextLevel.small.toLocaleString()} / {nextLevel.big.toLocaleString()}
          {nextLevel.ante > 0 && (
            <span className="ds-next__ante"> · Ante {nextLevel.ante.toLocaleString()}</span>
          )}
        </span>
      </>
    )
  ) : null;

  const blindsBlock = isBreakLevel ? (
    <DsBlinds isBreak pauseLabel={formatPauseBanner(pauseKind)} small={0} big={0} ante={0} />
  ) : (
    <DsBlinds small={state?.smallBlind ?? 0} big={state?.bigBlind ?? 0} ante={state?.ante ?? 0} />
  );

  const timerNode = (extraClass: string, extraStyle?: CSSProperties) => {
    const cls = `ds-timer${isRunning ? " ds-timer--running" : ""}${isPaused ? " ds-timer--paused" : ""}${extraClass}`;
    if (onTimerClick) {
      return (
        <button type="button" className={cls} style={extraStyle} onClick={onTimerClick} title="클릭하여 시간 직접 설정">
          {timerText}
        </button>
      );
    }
    return (
      <p className={cls} style={extraStyle}>
        {timerText}
      </p>
    );
  };

  return (
    <div
      className={`ds${statusClass} ${className}`.trim()}
      data-theme={theme}
      style={bgStyle}
      onPointerDown={
        edit
          ? (e) => {
              if (e.target === e.currentTarget || (e.target as HTMLElement).classList.contains("ds-stage")) {
                edit.onSelect(null);
              }
            }
          : undefined
      }
    >
      <div className="ds-stage">
        <div className="ds-glow ds-glow--a" />
        <div className="ds-glow ds-glow--b" />
        {(!activeLook || activeLook.showLogo) && <img src={logoUrl} className="ds-bg-logo" alt="" aria-hidden="true" />}

        {!hasGame ? (
          <div className="ds-idle">
            <p className="ds-idle__text">대기 중</p>
            <p className="ds-idle__sub">M{idleSlot}</p>
          </div>
        ) : (
          <>
            <div className="ds-title-bar">
              <OverlayWrap id="title" look={activeLook} edit={edit}>
                <p className="ds-game-name">{state?.blindStructureName ?? session?.structureName ?? "MNF HOLDEM"}</p>
              </OverlayWrap>
            </div>
            <div className="ds-layout">
              <aside className="ds-left">
                {showNotice ? (
                  <OverlayWrap id="notice" look={activeLook} edit={edit}>
                    <div
                      className="ds-left__notice-html"
                      dangerouslySetInnerHTML={{ __html: sanitizeNoticeHtml(notice ?? "") }}
                    />
                  </OverlayWrap>
                ) : (
                  <p className="ds-left__placeholder" />
                )}
              </aside>
              <main className="ds-center">
                <OverlayWrap id="level" look={activeLook} edit={edit}>
                  <p className="ds-level">{formatTimerLevelHeadline(state)}</p>
                </OverlayWrap>
                <OverlayWrap id="timer" look={activeLook} edit={edit}>
                  {timerNode(timerColorSet ? (useGrad ? " ds-timer--look-grad" : " ds-timer--look-solid") : "", timerStyle)}
                </OverlayWrap>
                <OverlayWrap id="blinds" look={activeLook} edit={edit}>
                  {blindsBlock}
                </OverlayWrap>
                {nextBlock && (
                  <OverlayWrap id="next" look={activeLook} edit={edit}>
                    <div className="ds-next">{nextBlock}</div>
                  </OverlayWrap>
                )}
              </main>
              <aside className="ds-right">
                <OverlayWrap id="totalTime" look={activeLook} edit={edit}>
                  <FlowStat label="TOTAL TIME" value={totalTimeText} look={activeLook} mono />
                </OverlayWrap>
                <div className="ds-right__div" />
                <OverlayWrap id="player" look={activeLook} edit={edit}>
                  <FlowStat label="PLAYER" value={`${players} / ${entries}`} highlight look={activeLook} />
                </OverlayWrap>
                <div className="ds-right__div" />
                <OverlayWrap id="entry" look={activeLook} edit={edit}>
                  <FlowStat label="ENTRY" value={String(entries)} look={activeLook} />
                </OverlayWrap>
                <OverlayWrap id="rebuy" look={activeLook} edit={edit}>
                  <FlowStat label="REBUY" value={String(totalRebuy)} look={activeLook} />
                </OverlayWrap>
                <div className="ds-right__div" />
                <OverlayWrap id="totalChip" look={activeLook} edit={edit}>
                  <FlowStat label="TOTAL CHIP" value={totalChip.toLocaleString()} look={activeLook} />
                </OverlayWrap>
                <OverlayWrap id="avgChip" look={activeLook} edit={edit}>
                  <FlowStat label="AVG CHIP" value={avgChip.toLocaleString()} look={activeLook} />
                </OverlayWrap>
                <div className="ds-right__div" />
                <OverlayWrap id="nextBreak" look={activeLook} edit={edit}>
                  <FlowStat label="NEXT BREAK" value={nextBreakText} muted={nextBreakText === "—"} look={activeLook} />
                </OverlayWrap>
              </aside>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function FlowStat({
  label,
  value,
  highlight,
  muted,
  mono,
  look,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  muted?: boolean;
  mono?: boolean;
  look: TimerLook | null;
}) {
  const id =
    label === "TOTAL TIME"
      ? "totalTime"
      : label === "PLAYER"
        ? "player"
        : label === "ENTRY"
          ? "entry"
          : label === "REBUY"
            ? "rebuy"
            : label === "TOTAL CHIP"
              ? "totalChip"
              : label === "AVG CHIP"
                ? "avgChip"
                : "nextBreak";
  const w = look?.widgets[id];
  return (
    <div className="ds-stat">
      <span
        className="ds-stat__label"
        style={
          w?.labelColorSet
            ? { color: w.labelColor ?? w.color, ...(w.sizeSet ? { fontSize: lookFontSize(w.labelFontSize ?? 16) } : {}) }
            : undefined
        }
      >
        {label}
      </span>
      <span
        className={`ds-stat__val${highlight ? " ds-stat__val--hi" : ""}${muted ? " ds-stat__val--muted" : ""}${mono ? " ds-stat__val--mono" : ""}`}
        style={
          w?.colorSet || w?.sizeSet
            ? {
                ...(w.colorSet ? { color: w.color } : {}),
                ...(w.sizeSet ? { fontSize: lookFontSize(w.fontSize) } : {}),
              }
            : undefined
        }
      >
        {value}
      </span>
    </div>
  );
}

function OverlayWrap({
  id,
  look,
  edit,
  children,
}: {
  id: TimerWidgetId;
  look: TimerLook | null;
  edit?: BroadcastEdit;
  children: ReactNode;
}) {
  const w = look?.widgets[id];
  if (w && w.visible === false && !edit) return null;
  const selected = edit?.selected === id;
  const ox = w?.ox ?? 0;
  const oy = w?.oy ?? 0;
  const hasLook =
    !!edit ||
    ox !== 0 ||
    oy !== 0 ||
    w?.sizeSet === true ||
    w?.colorSet === true ||
    w?.labelColorSet === true ||
    (w != null && w.visible === false);
  if (!hasLook) return <>{children}</>;
  const drag = edit
    ? {
        onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => {
          if (e.button !== 0) return;
          e.preventDefault();
          e.stopPropagation();
          edit.onSelect(id);
          const stage = e.currentTarget.closest(".ds-stage") as HTMLElement | null;
          if (!stage) return;
          const rect = stage.getBoundingClientRect();
          const startOx = w?.ox ?? 0;
          const startOy = w?.oy ?? 0;
          const startX = e.clientX;
          const startY = e.clientY;
          const target = e.currentTarget;
          target.setPointerCapture(e.pointerId);
          const move = (ev: PointerEvent) => {
            edit.onMove(
              id,
              clampRange(startOx + ((ev.clientX - startX) / rect.width) * 100, -80, 80),
              clampRange(startOy + ((ev.clientY - startY) / rect.height) * 100, -80, 80),
            );
          };
          const up = () => {
            target.removeEventListener("pointermove", move);
            target.removeEventListener("pointerup", up);
            target.removeEventListener("pointercancel", up);
          };
          target.addEventListener("pointermove", move);
          target.addEventListener("pointerup", up);
          target.addEventListener("pointercancel", up);
        },
      }
    : {};

  const extra: CSSProperties = {};
  if (ox || oy) extra.transform = `translate(${ox}cqw, ${oy}cqh)`;
  if (w?.sizeSet) extra.fontSize = lookFontSize(w.fontSize);
  if (id === "notice" && w?.sizeSet && w.w != null) extra.width = `${w.w}cqw`;
  if (id === "title" && w?.colorSet) extra.color = w.color;
  if (id === "level" && w?.colorSet) {
    extra.color = w.color;
    if (w.pillBg) extra.background = w.pillBg;
  }
  if (id === "notice" && w?.colorSet) extra.color = w.color;
  if (id === "next" && w?.colorSet) extra.color = w.color;
  const vars: Record<string, string> = {};
  if ((id === "blinds" || id === "next") && w?.colorSet) vars["--item-color"] = w.color;
  if ((id === "blinds" || id === "next") && w?.labelColorSet) {
    vars["--item-label"] = w.labelColor ?? w.color;
  }

  const className = [
    "ds-overlay",
    `ds-overlay--${id}`,
    w?.sizeSet ? "ds-overlay--size" : "",
    w?.colorSet ? "ds-overlay--color" : "",
    w?.labelColorSet ? "ds-overlay--label" : "",
    edit ? "ds-item--editing" : "",
    selected ? "ds-item--selected" : "",
    w && !w.visible ? "ds-item--hidden" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={className}
      data-widget={id}
      style={{ ...extra, ...vars }}
      {...drag}
    >
      {children}
    </div>
  );
}

function clampRange(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

