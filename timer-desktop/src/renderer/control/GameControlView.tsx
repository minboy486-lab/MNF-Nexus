import { useEffect, useRef, useState } from "react";
import type { TableTimerState, TimerAction } from "@mnf/timer/types";
import type { GameSession } from "../../shared/types";
import { formatRemainingMs, getDisplayRemainingMs } from "@mnf/timer/engine";

type Props = {
  session: GameSession;
  state: TableTimerState | undefined;
  pending: boolean;
  error: string | null;
  onBack: () => void;
  onCommand: (action: TimerAction, options?: { minutes?: number; ms?: number; sec?: number }) => void;
  onDeleteGame: () => void;
};

const POPUP_W = 280;
const POPUP_H = 210;

function TimerSetPopup({
  pos, mm, ss, mmRef, ssRef, onMM, onSS, onSubmit, onClose,
}: {
  pos: { x: number; y: number };
  mm: string; ss: string;
  mmRef: React.RefObject<HTMLInputElement | null>;
  ssRef: React.RefObject<HTMLInputElement | null>;
  onMM: (v: string) => void;
  onSS: (v: string) => void;
  onSubmit: () => void;
  onClose: () => void;
}) {
  const GAP = 10;
  let left = pos.x + GAP;
  let top = pos.y + GAP;
  if (left + POPUP_W > window.innerWidth - 8) left = pos.x - POPUP_W - GAP;
  if (top + POPUP_H > window.innerHeight - 8) top = pos.y - POPUP_H - GAP;
  left = Math.max(8, left);
  top = Math.max(8, top);

  return (
    <div className="timer-popup-overlay" onClick={onClose}>
      <div
        className="timer-popup timer-popup--anchored"
        style={{ left, top }}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="timer-popup__title">시간 설정</p>
        <div className="timer-popup__inputs">
          <div className="timer-popup__field">
            <input
              ref={mmRef}
              type="number" min={0} max={99} placeholder="MM"
              value={mm}
              className="timer-popup__input"
              onChange={(e) => onMM(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") onSubmit(); }}
            />
            <span className="timer-popup__unit">분</span>
          </div>
          <span className="timer-popup__colon">:</span>
          <div className="timer-popup__field">
            <input
              ref={ssRef}
              type="number" min={0} max={59} placeholder="SS"
              value={ss}
              className="timer-popup__input"
              onChange={(e) => onSS(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") onSubmit(); }}
            />
            <span className="timer-popup__unit">초</span>
          </div>
        </div>
        <div className="timer-popup__actions">
          <button type="button" className="timer-popup__cancel" onClick={onClose}>취소</button>
          <button type="button" className="timer-popup__confirm" onClick={onSubmit}>적용</button>
        </div>
      </div>
    </div>
  );
}

function CounterRow({
  label,
  value,
  display,
  onMinus,
  onPlus,
  disablePlus,
  disableMinus,
  keyMinus,
  keyPlus,
}: {
  label: string;
  value: string | number;
  display?: string;
  onMinus: () => void;
  onPlus: () => void;
  disablePlus?: boolean;
  disableMinus?: boolean;
  keyMinus?: string;
  keyPlus?: string;
}) {
  return (
    <div className="counter-row">
      <span className="counter-row__label">{label}</span>
      <div className="counter-row__ctrl">
        <button type="button" className="counter-btn counter-btn--minus" onClick={onMinus} disabled={disableMinus}>
          −{keyMinus && <span className="counter-btn__key">{keyMinus}</span>}
        </button>
        <span className="counter-row__val">{display ?? value}</span>
        <button type="button" className="counter-btn counter-btn--plus" onClick={onPlus} disabled={disablePlus}>
          +{keyPlus && <span className="counter-btn__key">{keyPlus}</span>}
        </button>
      </div>
    </div>
  );
}

function fmt(n: number) {
  return n.toLocaleString("ko-KR");
}

export function GameControlView({
  session,
  state,
  pending,
  error,
  onBack,
  onCommand,
  onDeleteGame,
}: Props) {
  const [players, setPlayers] = useState(session.players);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [timerPopup, setTimerPopup] = useState<{ x: number; y: number } | null>(null);
  const [timerMM, setTimerMM] = useState("");
  const [timerSS, setTimerSS] = useState("");
  const mmRef = useRef<HTMLInputElement>(null);
  const ssRef = useRef<HTMLInputElement>(null);
  const [entries, setEntries] = useState(session.entries);
  const [rebuys, setRebuys] = useState<number[]>([...session.rebuys]);
  const [addon, setAddon] = useState(session.addon);
  const [bonusChip, setBonusChip] = useState(session.bonusChip);

  // 게임 전환 시 로컬 상태 리셋
  useEffect(() => {
    setPlayers(session.players);
    setEntries(session.entries);
    setRebuys([...session.rebuys]);
    setAddon(session.addon);
    setBonusChip(session.bonusChip);
  }, [session.gameId]);

  // ESC — 팝업 열려있으면 팝업만 닫고 버블링 차단
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (deleteConfirmRef.current) {
          e.stopImmediatePropagation();
          setDeleteConfirm(false);
          return;
        }
        if (timerPopup) { e.stopImmediatePropagation(); setTimerPopup(null); return; }
      }
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [timerPopup, deleteConfirm]);

  // 게임 컨트롤 단축키
  useEffect(() => {
    const KO_TO_EN: Record<string, string> = {
      ㅂ:"q", ㅈ:"w", ㄷ:"e", ㄱ:"r", ㅅ:"t", 㛧:"y", ㅕ:"u", ㅑ:"i", ㅐ:"o", ㅔ:"p",
      ㅁ:"a", ㄴ:"s", ㅇ:"d", ㄹ:"f", ㅎ:"g", ㅗ:"h", ㅓ:"j", ㅏ:"k", ㅣ:"l",
      ㅋ:"z", ㅌ:"x", ㅊ:"c", ㅍ:"v", ㅠ:"b", ㅜ:"n", ㅡ:"m",
    };

    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (timerPopup) return;

      // Insert: 리셋
      if (e.key === "Insert") { onCommand("reset"); return; }
      // Delete: 게임 종료 확인
      if (e.key === "Delete") { setDeleteConfirm(true); return; }

      // deleteConfirm 열려있을 때 1/y=YES, 2/n/ESC=NO
      if (deleteConfirmRef.current) {
        if (e.key === "1" || e.key === "y" || e.key === "Y") {
          setDeleteConfirm(false); onDeleteGame(); return;
        }
        if (e.key === "2" || e.key === "n" || e.key === "N" || e.key === "Escape") {
          setDeleteConfirm(false); return;
        }
        return;
      }

      const raw = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      const key = KO_TO_EN[raw] ?? raw;

      // 스페이스: 시작/일시정지 토글
      if (e.key === " ") {
        e.preventDefault();
        if (state?.status === "running") onCommand("pause");
        else onCommand("start");
        return;
      }

      // 시간 조정: -(−10초) / +(+10초), Shift+-(−1분) / Shift++(+1분)
      if (e.key === "-" || e.key === "_") {
        if (e.shiftKey) { onCommand("adjustSec", { sec: -60 }); }
        else { onCommand("adjustSec", { sec: -10 }); }
        return;
      }
      if (e.key === "=" || e.key === "+" || e.key === "±") {
        if (e.shiftKey) { onCommand("adjustSec", { sec: 60 }); }
        else { onCommand("adjustSec", { sec: 10 }); }
        return;
      }

      // 플레이어: 1(-) / 2(+)
      if (e.key === "1") { subPlayerRef.current?.(); return; }
      if (e.key === "2") { addPlayerRef.current?.(); return; }

      // 엔트리: q(-) / w(+)
      if (key === "q") { subEntryRef.current?.(); return; }
      if (key === "w") { addEntryRef.current?.(); return; }

      // 리바인/애드온/보너스: a/s, z/x, r/t, f/g, v/b 순서
      const rowMinus = ["a","z","r","f","v"];
      const rowPlus  = ["s","x","t","g","b"];
      const mi = rowMinus.indexOf(key);
      const pi = rowPlus.indexOf(key);
      if (mi !== -1) { rowMinusRef.current[mi]?.(); return; }
      if (pi !== -1) { rowPlusRef.current[pi]?.(); return; }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [state, timerPopup, onCommand]);

  // 최신 deleteConfirm 상태를 ref로 유지
  const deleteConfirmRef = useRef(deleteConfirm);
  useEffect(() => { deleteConfirmRef.current = deleteConfirm; }, [deleteConfirm]);

  // 최신 함수를 ref로 유지 (클로저 문제 방지)
  const subPlayerRef = useRef<(() => void) | null>(null);
  const addPlayerRef = useRef<(() => void) | null>(null);
  const subEntryRef  = useRef<(() => void) | null>(null);
  const addEntryRef  = useRef<(() => void) | null>(null);
  // rows: [리바인0, 리바인1, 리바인2, 애드온, 보너스칩]
  const rowMinusRef  = useRef<Array<(() => void) | null>>([null, null, null, null, null]);
  const rowPlusRef   = useRef<Array<(() => void) | null>>([null, null, null, null, null]);

  function openTimerPopup(e: React.MouseEvent) {
    setTimerMM("");
    setTimerSS("");
    setTimerPopup({ x: e.clientX, y: e.clientY });
    setTimeout(() => mmRef.current?.focus(), 0);
  }

  function submitTimerPopup() {
    const m = parseInt(timerMM || "0", 10);
    const s = Math.min(parseInt(timerSS || "0", 10), 59);
    const ms = (m * 60 + s) * 1000;
    if (ms > 0) onCommand("setRemainingMs", { ms });
    setTimerPopup(null);
  }

  function push(patch: { players?: number; entries?: number; rebuys?: number[]; addon?: number; bonusChip?: number }) {
    void window.controlApi.updateCounters(session.gameId, patch);
  }

  // 엔트리 +: 엔트리 +1, 플레이어 +1
  function addEntry() {
    const e = entries + 1;
    const p = players + 1;
    setEntries(e);
    setPlayers(p);
    push({ entries: e, players: p });
  }
  function subEntry() {
    if (entries <= 0) return;
    const e = entries - 1;
    const p = Math.max(0, players - 1);
    setEntries(e);
    setPlayers(p);
    push({ entries: e, players: p });
  }

  // 플레이어: 독립
  function addPlayer() {
    const p = players + 1;
    setPlayers(p);
    push({ players: p });
  }
  function subPlayer() {
    if (players <= 0) return;
    const p = players - 1;
    setPlayers(p);
    push({ players: p });
  }

  // 리바인 (각 차수 독립)
  function addRebuy(idx: number) {
    const next = [...rebuys];
    next[idx] = (next[idx] ?? 0) + 1;
    setRebuys(next);
    push({ rebuys: next });
  }
  function subRebuy(idx: number) {
    const next = [...rebuys];
    if ((next[idx] ?? 0) <= 0) return;
    next[idx] = next[idx] - 1;
    setRebuys(next);
    push({ rebuys: next });
  }

  function addAddon() { const v = addon + 1; setAddon(v); push({ addon: v }); }
  function subAddon() { if (addon <= 0) return; const v = addon - 1; setAddon(v); push({ addon: v }); }
  function addBonus() { const v = bonusChip + 1; setBonusChip(v); push({ bonusChip: v }); }
  function subBonus() { if (bonusChip <= 0) return; const v = bonusChip - 1; setBonusChip(v); push({ bonusChip: v }); }

  // ref 업데이트 (최신 함수 반영)
  subPlayerRef.current = subPlayer;
  addPlayerRef.current = addPlayer;
  subEntryRef.current  = subEntry;
  addEntryRef.current  = addEntry;
  // rows 순서: 리바인0, 리바인1, 리바인2, 애드온, 보너스칩
  rowMinusRef.current = [
    () => subRebuy(0),
    () => subRebuy(1),
    () => subRebuy(2),
    session.hasAddon ? subAddon : null,
    session.hasBonusChip ? subBonus : null,
  ];
  rowPlusRef.current = [
    () => addRebuy(0),
    () => addRebuy(1),
    () => addRebuy(2),
    session.hasAddon ? addAddon : null,
    session.hasBonusChip ? addBonus : null,
  ];

  // 칩 계산
  const totalRebuy = rebuys.reduce((a, b) => a + b, 0);
  const totalChip =
    entries * session.entryChip +
    rebuys.reduce((sum, cnt, i) => sum + cnt * (session.rebuyChips[i] ?? 0), 0) +
    (session.hasAddon ? addon * session.addonChip : 0) +
    (session.hasBonusChip ? bonusChip * session.bonusChipAmount : 0);
  const avgChip = players > 0 ? Math.round(totalChip / players) : 0;

  const remainingMs = state ? getDisplayRemainingMs(state) : 0;
  const timerText = !state || state.status === "stopped" ? "—" : formatRemainingMs(remainingMs);

  // 다음 레벨 (break 포함)
  const currentLevel = state?.blindLevel ?? 1;
  const gcSortedLevels = state?.levels ? [...state.levels].sort((a,b) => a.level - b.level) : [];
  const gcCurIdx = gcSortedLevels.findIndex(l => l.level === currentLevel);
  const nextLevel = gcCurIdx >= 0 ? (gcSortedLevels[gcCurIdx + 1] ?? null) : null;
  const gcIsBreak = (state?.bigBlind ?? -1) === 0 && (state?.smallBlind ?? -1) === 0 && !!state?.blindStructureId;

  // 총 경과 시간
  const _startedAt = session.startedAt;
  const totalElapsedSec = (_startedAt && isFinite(_startedAt))
    ? Math.max(0, Math.floor((Date.now() - _startedAt) / 1000))
    : 0;
  const totalTimeText = (_startedAt && isFinite(_startedAt))
    ? `${String(Math.floor(totalElapsedSec / 3600)).padStart(2,"0")}:${String(Math.floor((totalElapsedSec % 3600) / 60)).padStart(2,"0")}:${String(totalElapsedSec % 60).padStart(2,"0")}`
    : "—";

  // 다음 브레이크까지 남은 시간
  const nextBreakText = (() => {
    if (!state?.levels) return "—";
    let secSum = Math.ceil(remainingMs / 1000);
    let found = false;
    for (const lv of state.levels) {
      if (lv.level <= currentLevel) continue;
      if (lv.small === 0 && lv.big === 0) { found = true; break; }
      secSum += lv.durationSec;
    }
    if (!found) return "—";
    const h = Math.floor(secSum / 3600);
    const m = Math.floor((secSum % 3600) / 60);
    const s = secSum % 60;
    if (h > 0) return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
    return `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
  })();
  const statusText =
    state?.status === "running" ? "진행" : state?.status === "paused" ? "일시정지" : "정지";

  return (
    <section className="sub-panel">
      <button type="button" className="back-btn" onClick={onBack}>
        ← 매장 화면
      </button>

      <div className="game-head">
        <div className="game-head__info">
          <h2>Game {session.gameId}</h2>
          <p className="muted">{session.structureName}</p>
        </div>
        <span className={`status-pill status-${state?.status ?? "stopped"}`}>
          {statusText}
        </span>
      </div>

      <div className="gc-body">
        {/* 왼쪽: 타이머 + 조작 */}
        <div className="gc-left">
          {/* 미니 송출 화면 — 3컬럼 */}
          <div className={`mini-display mini-display--${state?.status ?? "stopped"}`}>
            <div className="mini-display__glow" />
            {/* 게임 이름 타이틀바 */}
            <div className="mini-display__title">{session.structureName}</div>
            <div className="mini-display__layout">
              {/* 좌측 (비어있음) */}
              <aside className="mini-display__left" />
              {/* 중앙 */}
              <main className="mini-display__center">
                <div className="mini-display__center-top">
                  <div className="mini-display__level">{gcIsBreak ? "BREAK" : `LEVEL ${currentLevel}`}</div>
                  <button
                    type="button"
                    className="mini-display__timer"
                    onClick={(e) => openTimerPopup(e)}
                    title="클릭하여 시간 직접 설정"
                  >
                    {timerText}
                  </button>
                  {gcIsBreak ? (
                    <div className="mini-display__blinds">
                      <span className="mini-display__blinds-val mini-display__blinds-val--break">BREAK TIME</span>
                    </div>
                  ) : (
                    <div className="mini-display__blinds">
                      <span className="mini-display__blinds-label">BLINDS</span>
                      <span className="mini-display__blinds-val">
                        {(state?.smallBlind ?? 0).toLocaleString()} / {(state?.bigBlind ?? 0).toLocaleString()}
                      </span>
                      {(state?.ante ?? 0) > 0 && (
                        <><span className="mini-display__blinds-sep">·</span>
                        <span className="mini-display__blinds-label">ANTE</span>
                        <span className="mini-display__blinds-val">{(state?.ante ?? 0).toLocaleString()}</span></>
                      )}
                    </div>
                  )}
                  {nextLevel && (
                    <div className="mini-display__next">
                      {nextLevel.big === 0 ? (
                        <>
                          <span className="mini-display__next-label">NEXT</span>
                          <span className="mini-display__next-val">BREAK ({Math.round(nextLevel.durationSec / 60)}min)</span>
                        </>
                      ) : (
                        <>
                          <span className="mini-display__next-label">NEXT LV.{nextLevel.level}</span>
                          <span className="mini-display__next-val">
                            {nextLevel.small.toLocaleString()} / {nextLevel.big.toLocaleString()}
                            {nextLevel.ante > 0 && <span className="mini-display__next-ante"> · Ante {nextLevel.ante.toLocaleString()}</span>}
                          </span>
                        </>
                      )}
                    </div>
                  )}
                </div>
                <div className="mini-display__adj">
                  <button type="button" className="mini-display__adj-btn" onClick={() => onCommand("adjustSec", { sec: -60 })}>−1분 <span className="time-adj-key">⇧-</span></button>
                  <button type="button" className="mini-display__adj-btn" onClick={() => onCommand("adjustSec", { sec: -10 })}>−10초 <span className="time-adj-key">-</span></button>
                  <button type="button" className="mini-display__adj-btn mini-display__adj-btn--plus" onClick={() => onCommand("adjustSec", { sec: 10 })}>+10초 <span className="time-adj-key">+</span></button>
                  <button type="button" className="mini-display__adj-btn mini-display__adj-btn--plus" onClick={() => onCommand("adjustSec", { sec: 60 })}>+1분 <span className="time-adj-key">⇧+</span></button>
                </div>
              </main>
              {/* 우측 */}
              <aside className="mini-display__right">
                <MdStat label="TOTAL TIME" value={totalTimeText} />
                <div className="mini-display__div" />
                <MdStat label="PLAYER" value={`${players} / ${entries}`} hi />
                <div className="mini-display__div" />
                <MdStat label="ENTRY" value={String(entries)} />
                <MdStat label="REBUY" value={String(totalRebuy)} />
                <div className="mini-display__div" />
                <MdStat label="TOTAL CHIP" value={totalChip.toLocaleString()} />
                <MdStat label="AVG CHIP" value={avgChip.toLocaleString()} />
                <div className="mini-display__div" />
                <MdStat label="NEXT BREAK" value={nextBreakText} muted={nextBreakText === "—"} />
              </aside>
            </div>
          </div>

          {/* 시작 / 일시정지 */}
          <div className="game-actions game-actions--2">
            <button type="button" disabled={pending} onClick={() => onCommand("start")}>
              시작 <span className="action-key">Space</span>
            </button>
            <button type="button" disabled={pending} onClick={() => onCommand("pause")}>
              일시정지 <span className="action-key">Space</span>
            </button>
          </div>

          {/* 블라인드 레벨 −+ */}
          <CounterRow
            label="블라인드"
            value={`Lv ${state?.blindLevel ?? 1}`}
            onMinus={() => onCommand("levelDown")}
            onPlus={() => onCommand("levelUp")}
          />

          {/* 시간 설정 팝업 */}
          {timerPopup && <TimerSetPopup
            pos={timerPopup}
            mm={timerMM} ss={timerSS}
            mmRef={mmRef} ssRef={ssRef}
            onMM={(v) => { setTimerMM(v); if (v.length >= 2) ssRef.current?.focus(); }}
            onSS={setTimerSS}
            onSubmit={submitTimerPopup}
            onClose={() => setTimerPopup(null)}
          />}

          <button type="button" className="reset-btn" disabled={pending} onClick={() => onCommand("reset")}>
            리셋 <span className="action-key">Ins</span>
          </button>

          <button type="button" className="danger-btn" disabled={pending} onClick={() => setDeleteConfirm(true)}>
            게임 종료 <span className="action-key">Del</span>
          </button>

          {deleteConfirm && (
            <div className="delete-confirm-overlay" onClick={() => setDeleteConfirm(false)}>
              <div className="delete-confirm" onClick={(e) => e.stopPropagation()}>
                <p className="delete-confirm__msg">게임을 종료하시겠습니까?</p>
                <div className="delete-confirm__btns">
                  <button
                    className="confirm-btn confirm-btn--yes"
                    onClick={() => { setDeleteConfirm(false); onDeleteGame(); }}
                  >
                    <span className="confirm-btn__key">1</span>
                    YES
                  </button>
                  <button
                    className="confirm-btn confirm-btn--no"
                    onClick={() => setDeleteConfirm(false)}
                  >
                    <span className="confirm-btn__key">2</span>
                    NO
                  </button>
                </div>
              </div>
            </div>
          )}
          {error && <p className="error" style={{ marginTop: 8 }}>{error}</p>}
        </div>

        {/* 오른쪽: 카운터 + 칩 */}
        <div className="gc-right">
          {/* 칩 요약 */}
          <div className="chip-summary">
            <div className="chip-summary__item">
              <span className="chip-summary__label">TOTAL CHIP</span>
              <span className="chip-summary__val">{fmt(totalChip)}</span>
            </div>
            <div className="chip-summary__item">
              <span className="chip-summary__label">AVG CHIP</span>
              <span className="chip-summary__val">{fmt(avgChip)}</span>
            </div>
          </div>

          <div className="counter-divider" />

          {/* 총 엔트리 배지 */}
          <div className="rebuy-total-badge">
            <span className="rebuy-total-badge__label">총 엔트리</span>
            <span className="rebuy-total-badge__val">{entries}</span>
          </div>

          {/* 플레이어 (독립) */}
          <CounterRow
            label="플레이어"
            value={players}
            display={entries > 0 ? `${players} / ${entries}` : `${players}`}
            onMinus={subPlayer}
            onPlus={addPlayer}
            disablePlus={entries > 0 && players >= entries}
            keyMinus="1" keyPlus="2"
          />

          {/* 엔트리 (엔트리+플레이어 동시) */}
          <CounterRow
            label="엔트리"
            value={entries}
            onMinus={subEntry}
            onPlus={addEntry}
            keyMinus="Q" keyPlus="W"
          />

          <div className="counter-divider" />

          {/* 총 리바인 배지 */}
          {session.rebuyCount > 0 && (
            <div className="rebuy-total-badge">
              <span className="rebuy-total-badge__label">총 리바인</span>
              <span className="rebuy-total-badge__val">{totalRebuy}</span>
            </div>
          )}

          {/* 차수별 리바인 */}
          {(() => {
            const REBUY_KEYS = [["A","S"],["Z","X"],["R","T"]];
            return rebuys.map((v, i) => (
              <CounterRow
                key={i}
                label={session.rebuyCount === 1 ? "리바인" : `${i + 1}차 리바인`}
                value={v}
                onMinus={() => subRebuy(i)}
                onPlus={() => addRebuy(i)}
                keyMinus={REBUY_KEYS[i]?.[0]}
                keyPlus={REBUY_KEYS[i]?.[1]}
              />
            ));
          })()}

          {/* 애드온 */}
          {session.hasAddon && (
            <>
              <div className="counter-divider" />
              <CounterRow label="애드온" value={addon} onMinus={subAddon} onPlus={addAddon} keyMinus="F" keyPlus="G" />
            </>
          )}

          {/* 보너스칩 */}
          {session.hasBonusChip && (
            <CounterRow label="보너스칩" value={bonusChip} onMinus={subBonus} onPlus={addBonus} keyMinus="V" keyPlus="B" />
          )}
        </div>
      </div>
    </section>
  );
}

function MdStat({ label, value, hi, muted }: { label: string; value: string; hi?: boolean; muted?: boolean }) {
  return (
    <div className="md-stat">
      <span className="md-stat__label">{label}</span>
      <span className={`md-stat__val${hi ? " md-stat__val--hi" : ""}${muted ? " md-stat__val--muted" : ""}`}>{value}</span>
    </div>
  );
}
