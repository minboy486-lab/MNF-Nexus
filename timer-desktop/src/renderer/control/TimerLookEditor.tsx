import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { UI_THEME_OPTIONS, type UiThemeId } from "../../shared/types";
import {
  overlayFromTheme,
  patchTimerWidget,
  sampleLookSession,
  sampleLookTimer,
  TIMER_WIDGET_IDS,
  TIMER_WIDGET_LABELS,
  type SavedTimerTheme,
  type TimerLook,
  type TimerWidgetId,
  type TimerWidgetLook,
} from "../../shared/timerLook";
import { BroadcastStage } from "../shared/BroadcastStage";
import logoDisplayUrl from "./mnf-logo-display.png";

const BROADCAST_W = 1920;
const BROADCAST_H = 1080;
const HISTORY_MAX = 50;

function cloneLook(look: TimerLook): TimerLook {
  return JSON.parse(JSON.stringify(look)) as TimerLook;
}

const SIZE_TARGET: Record<TimerWidgetId, string> = {
  title: ".ds-game-name",
  level: ".ds-level",
  timer: ".ds-timer",
  blinds: ".ds-blinds__val, .ds-blinds__val--break",
  next: ".ds-next__val",
  notice: ".ds-left__notice-html",
  totalTime: ".ds-stat__val",
  player: ".ds-stat__val",
  entry: ".ds-stat__val",
  rebuy: ".ds-stat__val",
  totalChip: ".ds-stat__val",
  avgChip: ".ds-stat__val",
  nextBreak: ".ds-stat__val",
};

const LABEL_TARGET: Partial<Record<TimerWidgetId, string>> = {
  blinds: ".ds-blinds__label",
  next: ".ds-next__label",
  totalTime: ".ds-stat__label",
  player: ".ds-stat__label",
  entry: ".ds-stat__label",
  rebuy: ".ds-stat__label",
  totalChip: ".ds-stat__label",
  avgChip: ".ds-stat__label",
  nextBreak: ".ds-stat__label",
};

function readFontPx(el: Element | null): number {
  if (!el) return 0;
  const n = parseFloat(getComputedStyle(el).fontSize);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function measureWidgetSize(id: TimerWidgetId): { fontSize: number; labelFontSize: number } {
  const wrap = document.querySelector(`.look-editor__viewport [data-widget="${id}"]`);
  if (!wrap) return { fontSize: 0, labelFontSize: 0 };
  const main = wrap.querySelector(SIZE_TARGET[id]);
  const labelSel = LABEL_TARGET[id];
  const label = labelSel ? wrap.querySelector(labelSel) : null;
  return {
    fontSize: readFontPx(main ?? wrap),
    labelFontSize: readFontPx(label),
  };
}

type Props = {
  theme: UiThemeId;
  look: TimerLook;
  liveOriginal?: boolean;
  savedName?: string | null;
  activeSavedId?: string | null;
  savedThemes?: SavedTimerTheme[];
  onChange: (look: TimerLook) => void;
  onClear: (id?: string) => void | Promise<unknown>;
  onSaveAsTheme: (
    name: string,
    look: TimerLook,
    updateId?: string,
  ) => Promise<{ ok: true; id?: string } | { ok: false; error: string }>;
  onBack: () => void;
};

export function TimerLookEditor({
  theme,
  look: savedLook,
  liveOriginal = false,
  savedName = null,
  activeSavedId = null,
  savedThemes = [],
  onChange,
  onClear,
  onSaveAsTheme,
  onBack,
}: Props) {
  const openedSaved = Boolean(activeSavedId) && !liveOriginal;
  const [look, setLook] = useState(() => cloneLook(savedLook));
  const [wantsOriginal, setWantsOriginal] = useState(liveOriginal || openedSaved);
  const [leaveConfirm, setLeaveConfirm] = useState(false);
  const [loadOpen, setLoadOpen] = useState(false);
  const [previewTheme, setPreviewTheme] = useState<UiThemeId>(theme);
  const [workingSavedId, setWorkingSavedId] = useState<string | null>(activeSavedId);
  const [selected, setSelected] = useState<TimerWidgetId | null>("timer");
  const [scale, setScale] = useState(0.4);
  const [themeName, setThemeName] = useState(savedName ?? "");
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [histTick, setHistTick] = useState(0);
  const [liveSize, setLiveSize] = useState({ fontSize: 0, labelFontSize: 0 });
  const lookRef = useRef(look);
  const pastRef = useRef<TimerLook[]>([]);
  const futureRef = useRef<TimerLook[]>([]);
  const coalesceRef = useRef<{ key: string; at: number } | null>(null);
  const baselineRef = useRef(cloneLook(savedLook));
  const originRef = useRef(cloneLook(openedSaved ? savedLook : overlayFromTheme(theme)));
  const originApplyIdRef = useRef(openedSaved && activeSavedId ? activeSavedId : theme);

  lookRef.current = look;
  const dirty = JSON.stringify(look) !== JSON.stringify(baselineRef.current);
  const canUndo = histTick >= 0 && pastRef.current.length > 0;
  const canRedo = histTick >= 0 && futureRef.current.length > 0;

  const markClean = useCallback((asOriginal: boolean) => {
    baselineRef.current = cloneLook(lookRef.current);
    setWantsOriginal(asOriginal);
  }, []);

  const applySave = useCallback(async () => {
    const isDirty = JSON.stringify(lookRef.current) !== JSON.stringify(baselineRef.current);
    if (!isDirty) return;
    if (wantsOriginal) {
      await onClear(originApplyIdRef.current);
      markClean(true);
    } else {
      onChange(lookRef.current);
      markClean(false);
    }
    setSaveMsg("송출에 적용했습니다.");
    setSaveErr(null);
  }, [wantsOriginal, onClear, onChange, markClean]);

  const requestBack = useCallback(() => {
    const isDirty = JSON.stringify(lookRef.current) !== JSON.stringify(baselineRef.current);
    if (isDirty) setLeaveConfirm(true);
    else onBack();
  }, [onBack]);

  const confirmSaveAndLeave = useCallback(async () => {
    await applySave();
    setLeaveConfirm(false);
    onBack();
  }, [applySave, onBack]);

  const commitLook = useCallback((next: TimerLook, coalesceKey?: string) => {
    const current = lookRef.current;
    const now = Date.now();
    const same =
      !!coalesceKey &&
      coalesceRef.current?.key === coalesceKey &&
      now - coalesceRef.current.at < 450;
    if (!same) {
      pastRef.current = [...pastRef.current, cloneLook(current)].slice(-HISTORY_MAX);
      futureRef.current = [];
      setHistTick((n) => n + 1);
    }
    coalesceRef.current = coalesceKey ? { key: coalesceKey, at: now } : null;
    setWantsOriginal(false);
    setLook(next);
  }, []);

  const undoLook = useCallback(() => {
    const prev = pastRef.current;
    if (prev.length === 0) return;
    const restored = prev[prev.length - 1]!;
    pastRef.current = prev.slice(0, -1);
    futureRef.current = [...futureRef.current, cloneLook(lookRef.current)];
    coalesceRef.current = null;
    setWantsOriginal(false);
    setHistTick((n) => n + 1);
    setLook(cloneLook(restored));
  }, []);

  const redoLook = useCallback(() => {
    const next = futureRef.current;
    if (next.length === 0) return;
    const restored = next[next.length - 1]!;
    futureRef.current = next.slice(0, -1);
    pastRef.current = [...pastRef.current, cloneLook(lookRef.current)].slice(-HISTORY_MAX);
    coalesceRef.current = null;
    setWantsOriginal(false);
    setHistTick((n) => n + 1);
    setLook(cloneLook(restored));
  }, []);

  useEffect(() => {
    const fit = () => {
      const pad = 48;
      const panel = 300;
      const w = Math.max(320, window.innerWidth - panel - pad * 2);
      const h = Math.max(180, window.innerHeight - 88 - pad);
      setScale(Math.min(w / BROADCAST_W, h / BROADCAST_H, 0.85));
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  useEffect(() => {
    setThemeName(savedName ?? "");
    if (activeSavedId) setWorkingSavedId(activeSavedId);
  }, [savedName, activeSavedId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (loadOpen) {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopImmediatePropagation();
          setLoadOpen(false);
        }
        return;
      }
      if (leaveConfirm) {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopImmediatePropagation();
          setLeaveConfirm(false);
          return;
        }
        if (e.key === "1") {
          e.preventDefault();
          e.stopImmediatePropagation();
          void confirmSaveAndLeave();
          return;
        }
        if (e.key === "2") {
          e.preventDefault();
          e.stopImmediatePropagation();
          onBack();
          return;
        }
        if (e.key === "3") {
          e.preventDefault();
          e.stopImmediatePropagation();
          setLeaveConfirm(false);
          return;
        }
        return;
      }
      const tag = (e.target as HTMLElement | null)?.tagName;
      const typing = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopImmediatePropagation();
        requestBack();
        return;
      }
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "s") {
        e.preventDefault();
        e.stopImmediatePropagation();
        void applySave();
        return;
      }
      if (mod && e.key.toLowerCase() === "z") {
        if (typing) return;
        e.preventDefault();
        if (e.shiftKey) redoLook();
        else undoLook();
        return;
      }
      if (mod && e.key.toLowerCase() === "y") {
        if (typing) return;
        e.preventDefault();
        redoLook();
        return;
      }
      if (!selected) return;
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight" && e.key !== "ArrowUp" && e.key !== "ArrowDown") {
        return;
      }
      if (typing) return;
      e.preventDefault();
      const step = e.shiftKey ? 2 : 0.4;
      const w = look.widgets[selected];
      const ox = (w.ox ?? 0) + (e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0);
      const oy = (w.oy ?? 0) + (e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0);
      commitLook(patchTimerWidget(look, selected, { ox: clamp(ox, -80, 80), oy: clamp(oy, -80, 80) }), `move-${selected}`);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [look, selected, commitLook, undoLook, redoLook, leaveConfirm, loadOpen, onBack, applySave, requestBack, confirmSaveAndLeave]);

  const w = selected ? look.widgets[selected] : null;
  const hasLabel = selected
    ? selected === "blinds" ||
      selected === "next" ||
      selected === "totalTime" ||
      selected === "player" ||
      selected === "entry" ||
      selected === "rebuy" ||
      selected === "totalChip" ||
      selected === "avgChip" ||
      selected === "nextBreak"
    : false;

  useLayoutEffect(() => {
    if (!selected) return;
    let cancelled = false;
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!cancelled) setLiveSize(measureWidgetSize(selected));
      });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(id);
    };
  }, [selected, look, scale]);

  const shownFontSize =
    w && (w.sizeSet || liveSize.fontSize <= 0) ? Math.round(w.fontSize) : Math.round(liveSize.fontSize);
  const shownLabelSize =
    w && (w.sizeSet || liveSize.labelFontSize <= 0)
      ? Math.round(w.labelFontSize ?? 16)
      : Math.round(liveSize.labelFontSize);

  function patchSize(partial: Partial<TimerWidgetLook>, coalesceKey: string) {
    if (!selected || !w) return;
    const extra = { ...partial, sizeSet: true as const };
    if (!w.sizeSet) {
      if (extra.fontSize == null && liveSize.fontSize > 0) extra.fontSize = Math.round(liveSize.fontSize);
      if (extra.labelFontSize == null && liveSize.labelFontSize > 0) {
        extra.labelFontSize = Math.round(liveSize.labelFontSize);
      }
    }
    commitLook(patchTimerWidget(look, selected, extra), coalesceKey);
  }

  async function saveLookAsTheme(update: boolean) {
    if (saving) return;
    setSaveErr(null);
    setSaveMsg(null);
    setSaving(true);
    const result = await onSaveAsTheme(
      themeName,
      look,
      update && workingSavedId ? workingSavedId : undefined,
    );
    setSaving(false);
    if (!result.ok) {
      setSaveErr(result.error);
      return;
    }
    originRef.current = cloneLook(lookRef.current);
    if (result.id) {
      originApplyIdRef.current = result.id;
      setWorkingSavedId(result.id);
    }
    markClean(false);
    setSaveMsg(update ? "이 테마를 업데이트했습니다." : "타이머 테마에 저장했습니다.");
  }

  function restoreOrigin() {
    pastRef.current = [...pastRef.current, cloneLook(lookRef.current)].slice(-HISTORY_MAX);
    futureRef.current = [];
    coalesceRef.current = null;
    setHistTick((n) => n + 1);
    setLook(cloneLook(originRef.current));
    setWantsOriginal(true);
  }

  function loadDesign(next: TimerLook, applyId: string, name: string, base: UiThemeId) {
    pastRef.current = [...pastRef.current, cloneLook(lookRef.current)].slice(-HISTORY_MAX);
    futureRef.current = [];
    coalesceRef.current = null;
    const cloned = cloneLook(next);
    originRef.current = cloneLook(cloned);
    originApplyIdRef.current = applyId;
    setHistTick((n) => n + 1);
    setLook(cloned);
    setWantsOriginal(true);
    setPreviewTheme(base);
    const saved = applyId.startsWith("saved-");
    setWorkingSavedId(saved ? applyId : null);
    setThemeName(saved ? name : "");
    setLoadOpen(false);
    setSaveErr(null);
    setSaveMsg(`「${name}」을 불러왔습니다. 원래 디자인은 이 기준입니다.`);
  }

  return (
    <div className="look-editor">
      <header className="look-editor__bar">
        <button type="button" className="back-btn" onClick={requestBack}>
          ← 뒤로
        </button>
        <p className="look-editor__title">
          타이머 디자인
          {dirty ? <span className="look-editor__dirty"> · 저장 안 됨</span> : null}
        </p>
        <div className="look-editor__actions">
          <button
            type="button"
            className="look-editor__btn"
            onClick={() => commitLook(presetColorsKeepMove(look, overlayFromTheme(theme)))}
          >
            색만 프리셋
          </button>
          <button
            type="button"
            className="look-editor__btn"
            onClick={restoreOrigin}
          >
            원래 디자인
          </button>
          <button
            type="button"
            className="look-editor__btn look-editor__btn--primary"
            disabled={!dirty}
            onClick={() => void applySave()}
          >
            저장
          </button>
        </div>
      </header>

      <div className="look-editor__body">
        <div className="look-editor__stage-wrap">
          <div
            className="look-editor__viewport"
            style={{ width: BROADCAST_W * scale, height: BROADCAST_H * scale }}
          >
            <BroadcastStage
              theme={previewTheme}
              look={look}
              session={sampleLookSession()}
              state={sampleLookTimer()}
              logoUrl={logoDisplayUrl}
              edit={{
                selected,
                onSelect: setSelected,
                onMove: (id, ox, oy) => commitLook(patchTimerWidget(look, id, { ox, oy }), `move-${id}`),
              }}
              style={{
                width: BROADCAST_W,
                height: BROADCAST_H,
                transform: `scale(${scale})`,
                transformOrigin: "top left",
              }}
            />
          </div>
          <p className="look-editor__hint">미리보기만 바뀝니다. 저장하면 송출에도 적용됩니다. 끌어 옮기기 · 화살표 미세 이동</p>
        </div>

        <aside className="look-editor__panel">
          <div className="look-editor__label-row">
            <div className="look-editor__hist">
              <button
                type="button"
                className="look-editor__hist-btn"
                title="실행 취소"
                disabled={!canUndo}
                onClick={undoLook}
              >
                ↺
              </button>
              <button
                type="button"
                className="look-editor__hist-btn"
                title="되돌리기"
                disabled={!canRedo}
                onClick={redoLook}
              >
                ↻
              </button>
            </div>
            <p className="look-editor__label">저장 / 불러오기</p>
          </div>
          <input
            className="look-editor__name"
            type="text"
            maxLength={24}
            placeholder="테마 이름"
            value={themeName}
            onChange={(e) => {
              setThemeName(e.target.value);
              setSaveErr(null);
              setSaveMsg(null);
            }}
          />
          <div className="look-editor__save-row">
            <button
              type="button"
              className="look-editor__btn"
              onClick={() => setLoadOpen(true)}
            >
              불러오기
            </button>
            {workingSavedId && (
              <button
                type="button"
                className="look-editor__btn"
                disabled={saving}
                onClick={() => void saveLookAsTheme(true)}
              >
                이 테마 업데이트
              </button>
            )}
            <button
              type="button"
              className="look-editor__btn look-editor__btn--primary"
              disabled={saving}
              onClick={() => void saveLookAsTheme(false)}
            >
              테마로 저장
            </button>
          </div>
          {saveMsg && <p className="look-editor__msg">{saveMsg}</p>}
          {saveErr && <p className="look-editor__msg look-editor__msg--err">{saveErr}</p>}

          <p className="look-editor__label">배경</p>
          <div className="look-editor__row">
            <ColorField
              label="위"
              value={look.bg}
              onChange={(bg) => commitLook({ ...look, bg, bgSet: true }, "bg")}
            />
            <ColorField
              label="아래"
              value={look.bg2 ?? look.bg}
              onChange={(bg2) => commitLook({ ...look, bg2, bgSet: true }, "bg2")}
            />
          </div>
          <label className="look-editor__check">
            <input
              type="checkbox"
              checked={look.showLogo}
              onChange={(e) => commitLook({ ...look, showLogo: e.target.checked })}
            />
            로고 워터마크
          </label>

          <p className="look-editor__label">글자</p>
          <div className="look-editor__list">
            {TIMER_WIDGET_IDS.map((id) => (
              <button
                key={id}
                type="button"
                className={`look-editor__item${selected === id ? " look-editor__item--on" : ""}`}
                onClick={() => setSelected(id)}
              >
                {TIMER_WIDGET_LABELS[id]}
              </button>
            ))}
          </div>

          {selected && w && (
            <div className="look-editor__fields">
              <p className="look-editor__label">{TIMER_WIDGET_LABELS[selected]}</p>
              <label className="look-editor__check">
                <input
                  type="checkbox"
                  checked={w.visible}
                  onChange={(e) => commitLook(patchTimerWidget(look, selected, { visible: e.target.checked }))}
                />
                표시
              </label>
              <ColorField
                label={selected === "timer" ? "위 색" : "색"}
                value={w.color}
                onChange={(color) =>
                  commitLook(patchTimerWidget(look, selected, { color, colorSet: true }), `color-${selected}`)
                }
              />
              {selected === "timer" && (
                <ColorField
                  label="아래 색"
                  value={w.color2 ?? w.color}
                  onChange={(color2) =>
                    commitLook(patchTimerWidget(look, selected, { color2, colorSet: true }), `color2-${selected}`)
                  }
                />
              )}
              {selected === "level" && (
                <ColorField
                  label="배지 배경"
                  value={w.pillBg ?? "#000000"}
                  onChange={(pillBg) =>
                    commitLook(patchTimerWidget(look, selected, { pillBg, colorSet: true }), "pillBg")
                  }
                />
              )}
              {hasLabel && (
                <ColorField
                  label="라벨 색"
                  value={w.labelColor ?? w.color}
                  onChange={(labelColor) =>
                    commitLook(
                      patchTimerWidget(look, selected, { labelColor, labelColorSet: true }),
                      `labelColor-${selected}`,
                    )
                  }
                />
              )}
              <NumField
                label="글자 크기"
                value={shownFontSize}
                min={10}
                max={selected === "timer" ? 400 : 200}
                onChange={(fontSize) => patchSize({ fontSize }, `size-${selected}`)}
              />
              {hasLabel && (
                <NumField
                  label="라벨 크기"
                  value={shownLabelSize}
                  min={8}
                  max={80}
                  onChange={(labelFontSize) => patchSize({ labelFontSize }, `labelSize-${selected}`)}
                />
              )}
              {selected === "notice" && (
                <NumField
                  label="너비 %"
                  value={Math.round(w.w ?? 18)}
                  min={8}
                  max={60}
                  onChange={(width) => patchSize({ w: width }, "notice-w")}
                />
              )}
            </div>
          )}
        </aside>
      </div>

      {loadOpen && (
        <div className="settings-overlay" onClick={() => setLoadOpen(false)}>
          <div className="settings-popup look-editor__leave" onClick={(e) => e.stopPropagation()}>
            <h3 className="look-editor__leave-title">디자인 불러오기</h3>
            <p className="look-editor__leave-hint">불러오면 원래 디자인이 이 기준으로 바뀝니다.</p>
            <h3 className="settings-popup__title">기본 테마</h3>
            {UI_THEME_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                className={`settings-popup__btn${originApplyIdRef.current === opt.id ? " settings-popup__btn--active" : ""}`}
                onClick={() => loadDesign(overlayFromTheme(opt.id), opt.id, opt.label, opt.id)}
              >
                {opt.label}
              </button>
            ))}
            {savedThemes.length > 0 && (
              <>
                <h3 className="settings-popup__title">저장한 디자인</h3>
                {savedThemes.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    className={`settings-popup__btn${workingSavedId === opt.id ? " settings-popup__btn--active" : ""}`}
                    onClick={() => loadDesign(opt.look, opt.id, opt.name, opt.baseTheme)}
                  >
                    {opt.name}
                  </button>
                ))}
              </>
            )}
            {savedThemes.length === 0 && (
              <p className="look-editor__leave-hint">저장한 디자인이 없습니다. 테마로 저장하면 여기에 생깁니다.</p>
            )}
            <button
              type="button"
              className="settings-popup__btn settings-popup__btn--cancel"
              onClick={() => setLoadOpen(false)}
            >
              닫기
            </button>
          </div>
        </div>
      )}

      {leaveConfirm && (
        <div className="settings-overlay" onClick={() => setLeaveConfirm(false)}>
          <div className="settings-popup look-editor__leave" onClick={(e) => e.stopPropagation()}>
            <h3 className="look-editor__leave-title">변경 내용을 저장할까요?</h3>
            <p className="look-editor__leave-hint">저장하지 않으면 송출에는 반영되지 않습니다.</p>
            <div className="settings-popup__row look-editor__leave-row">
              <button
                type="button"
                className="confirm-btn confirm-btn--save"
                onClick={() => void confirmSaveAndLeave()}
              >
                <span className="confirm-btn__key">1</span>
                저장
              </button>
              <button
                type="button"
                className="confirm-btn confirm-btn--no"
                onClick={onBack}
              >
                <span className="confirm-btn__key">2</span>
                저장 안 함
              </button>
              <button
                type="button"
                className="confirm-btn confirm-btn--no"
                onClick={() => setLeaveConfirm(false)}
              >
                <span className="confirm-btn__key">3</span>
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function presetColorsKeepMove(current: TimerLook, preset: TimerLook): TimerLook {
  const widgets = { ...preset.widgets };
  for (const id of TIMER_WIDGET_IDS) {
    const cur = current.widgets[id];
    widgets[id] = {
      ...preset.widgets[id],
      ox: cur.ox,
      oy: cur.oy,
      w: cur.w,
      visible: cur.visible,
      sizeSet: cur.sizeSet,
      fontSize: cur.fontSize,
      labelFontSize: cur.labelFontSize,
      colorSet: true,
      labelColorSet: true,
    };
  }
  return {
    ...preset,
    overlay: true,
    bgSet: true,
    showLogo: current.showLogo,
    widgets,
  };
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="look-editor__color">
      <span>{label}</span>
      <input type="color" value={toColorInput(value)} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function NumField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="look-editor__num">
      <span>
        {label} <em>{value}</em>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

function toColorInput(value: string): string {
  const v = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(v)) return v;
  if (/^#[0-9a-fA-F]{3}$/.test(v)) {
    const r = v[1];
    const g = v[2];
    const b = v[3];
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return "#888888";
}
