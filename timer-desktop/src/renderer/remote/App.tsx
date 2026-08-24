import { useCallback, useEffect, useRef, useState } from "react";
import { formatRemainingMs, getDisplayRemainingMs } from "@mnf/timer/engine";
import type { TableTimerState } from "@mnf/timer/types";
import type { AppSnapshot, GameSession } from "../../shared/types";
import type {
  RemoteClientMsg,
  RemoteCounterOp,
  RemoteServerMsg,
  RemoteStaffState,
  RemoteTimerAction,
} from "../../shared/remote";
import logoUrl from "./mnf-logo.png";

const LS_LOGIN = "mnf-remote-login-id";
const LS_SESSION = "mnf-remote-session";
const LS_FROM = "mnf-web-origin";

const EMPTY_SNAP: AppSnapshot = {
  sessions: [],
  monitorAssignments: {},
  tableAssignments: {},
};

function pairingFromSearch(search: string): { pin: string; tok: string; loginId: string; from: string } {
  const q = new URLSearchParams(search);
  return {
    pin: q.get("pin")?.trim() ?? "",
    tok: q.get("tok")?.trim() ?? "",
    loginId: (q.get("id") ?? q.get("login") ?? "").trim().toLowerCase(),
    from: q.get("from")?.trim() ?? "",
  };
}

function statusLabel(status: TableTimerState["status"] | undefined): string {
  if (!status || status === "stopped") return "정지";
  if (status === "running") return "진행";
  return "일시정지";
}

function LongPressButton({
  label,
  sub,
  onFire,
  danger,
}: {
  label: string;
  sub: string;
  onFire: () => void;
  danger?: boolean;
}) {
  const timer = useRef<number | null>(null);
  function start() {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      timer.current = null;
      onFire();
    }, 1000);
  }
  function cancel() {
    if (timer.current) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }
  return (
    <button
      type="button"
      className={`hold-btn${danger ? " hold-btn--danger" : ""}`}
      onPointerDown={(e) => {
        e.preventDefault();
        start();
      }}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onContextMenu={(e) => e.preventDefault()}
      onClick={(e) => e.preventDefault()}
    >
      {label}
      <span>{sub}</span>
    </button>
  );
}

export function App() {
  const initial = pairingFromSearch(window.location.search);
  const [pin, setPin] = useState(initial.pin);
  const [tok, setTok] = useState(initial.tok);
  const [pinOk, setPinOk] = useState(false);
  const [loginId] = useState(
    () => initial.loginId || localStorage.getItem(LS_LOGIN) || "",
  );
  const [staff, setStaff] = useState<RemoteStaffState | null>(null);
  const [staffAuth, setStaffAuth] = useState<boolean | null>(null);
  const [snapshot, setSnapshot] = useState<AppSnapshot>(EMPTY_SNAP);
  const [timers, setTimers] = useState<TableTimerState[]>([]);
  const [gameId, setGameId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [checkoutConfirm, setCheckoutConfirm] = useState(false);
  const [, setTick] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  const pinOkRef = useRef(false);

  const send = useCallback((msg: RemoteClientMsg) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  }, []);

  function websiteUrl(path: string): string | null {
    const origin = (initial.from || localStorage.getItem(LS_FROM) || "").replace(/\/$/, "");
    if (!origin) return null;
    return `${origin}${path}`;
  }

  const connect = useCallback((nextPin: string) => {
    if (!nextPin) return;
    wsRef.current?.close();
    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${proto}//${location.host}/ws?pin=${encodeURIComponent(nextPin)}`);
    wsRef.current = ws;
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "hello", pin: nextPin } satisfies RemoteClientMsg));
    };
    ws.onmessage = (ev) => {
      let msg: RemoteServerMsg;
      try {
        msg = JSON.parse(String(ev.data)) as RemoteServerMsg;
      } catch {
        return;
      }
      if (msg.type === "hello_ok") {
        pinOkRef.current = true;
        setPinOk(true);
        setStaffAuth(msg.staffAuth);
        setError(null);
        const sessionToken = localStorage.getItem(LS_SESSION);
        const claimId = initial.loginId || localStorage.getItem(LS_LOGIN) || "";
        if (msg.staffAuth && tok && claimId) {
          ws.send(JSON.stringify({ type: "claim", token: tok, loginId: claimId } satisfies RemoteClientMsg));
        } else if (msg.staffAuth && sessionToken) {
          ws.send(JSON.stringify({ type: "resume", sessionToken } satisfies RemoteClientMsg));
        }
        return;
      }
      if (msg.type === "hello_fail") {
        pinOkRef.current = false;
        setPinOk(false);
        setError(msg.error);
        return;
      }
      if (msg.type === "staff") {
        localStorage.setItem(LS_SESSION, msg.sessionToken);
        localStorage.setItem(LS_LOGIN, msg.staff.loginId);
        setStaff(msg.staff);
        setError(null);
        if (msg.staff.canControl) {
          setTok("");
          const u = new URL(location.href);
          if (u.searchParams.has("tok")) {
            u.searchParams.delete("tok");
            history.replaceState(null, "", `${u.pathname}${u.search}${u.hash}`);
          }
        }
        return;
      }
      if (msg.type === "snapshot") {
        setSnapshot(msg.snapshot);
        setTimers(msg.timers);
        return;
      }
      if (msg.type === "error") {
        if (msg.error.includes("세션이 만료")) localStorage.removeItem(LS_SESSION);
        setError(msg.error);
      }
    };
    ws.onerror = () => {
      setError("와이파이 연결을 확인해주세요");
    };
    ws.onclose = () => {
      const wasOk = pinOkRef.current;
      pinOkRef.current = false;
      setPinOk(false);
      if (!wasOk) {
        setError((prev) => prev || "와이파이 연결을 확인해주세요");
        return;
      }
      window.setTimeout(() => {
        if (wsRef.current === ws) connect(nextPin);
      }, 1200);
    };
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (initial.from) localStorage.setItem(LS_FROM, initial.from);
    if (initial.pin) connect(initial.pin);
    return () => {
      const ws = wsRef.current;
      wsRef.current = null;
      ws?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (pinOk && staff && !staff.canControl && tok) {
      send({ type: "punch", token: tok });
    }
  }, [pinOk, staff, tok, send]);

  useEffect(() => {
    if (gameId != null && !snapshot.sessions.some((s) => s.gameId === gameId)) {
      setGameId(null);
    }
  }, [gameId, snapshot.sessions]);

  function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{4}$/.test(pin)) {
      setError("PIN 4자리를 입력하세요.");
      return;
    }
    connect(pin);
  }

  function checkout() {
    send({ type: "checkout" });
    setCheckoutConfirm(false);
    setGameId(null);
    setTok("");
    const url = websiteUrl("/staff");
    if (url) window.location.assign(url);
  }

  function logout() {
    send({ type: "logout" });
    localStorage.removeItem(LS_SESSION);
    const url = websiteUrl("/login");
    if (url) {
      window.location.assign(url);
      return;
    }
    setStaff(null);
    setGameId(null);
    setTok("");
  }

  const session = snapshot.sessions.find((s) => s.gameId === gameId) ?? null;
  const timer = timers.find((t) => t.tableId === gameId);
  const ready = pinOk && (staffAuth === false || !!staff?.canControl);

  return (
    <div className="remote">
      <header className="remote-header">
        {ready && gameId != null ? (
          <button
            type="button"
            className="games-list-btn"
            onClick={() => {
              setGameId(null);
              setMoreOpen(false);
            }}
          >
            ← 게임 목록
          </button>
        ) : websiteUrl("/staff") ? (
          <a className="games-list-btn" href={websiteUrl("/staff") ?? "/staff"}>
            ← 뒤로
          </a>
        ) : (
          <>
            <img src={logoUrl} alt="MNF" className="remote-logo" />
            <div>
              <p className="remote-kicker">매장 리모컨</p>
              <p className="remote-staff">
                {staffAuth === false
                  ? "PIN 연결됨"
                  : staff
                    ? `${staff.name}${staff.canControl ? " · 출근" : ""}`
                    : "직원 로그인"}
              </p>
            </div>
          </>
        )}
        {staff && staffAuth !== false && !staff.canControl && (
          <button type="button" className="text-btn" onClick={logout}>
            로그아웃
          </button>
        )}
        {staff?.canControl && gameId != null && (
          <button type="button" className="text-btn" onClick={() => setCheckoutConfirm(true)}>
            퇴근
          </button>
        )}
      </header>

      {error && <p className="remote-error">{error}</p>}

      {!pinOk && staff && <p className="muted">컨트롤러에 다시 연결하는 중...</p>}

      {!pinOk && !staff && (
        <form className="card" onSubmit={handleConnect}>
          <p className="card-title">컨트롤러 연결</p>
          <p className="muted">같은 Wi-Fi에서 컨트롤러 로고 QR을 스캔하거나 PIN을 입력하세요.</p>
          <input
            inputMode="numeric"
            maxLength={4}
            className="field"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
            placeholder="PIN 4자리"
          />
          <button type="submit" className="primary-btn">
            연결
          </button>
        </form>
      )}

      {pinOk && staffAuth && !staff && tok && loginId && (
        <p className="muted">출근 처리 중...</p>
      )}

      {pinOk && staffAuth && !staff && !(tok && loginId) && (
        <div className="card">
          <p className="card-title">웹에서 출근 등록</p>
          <p className="muted">직원 웹에 로그인한 뒤 컨트롤러 QR을 스캔하면 연결됩니다.</p>
          {websiteUrl("/login") && (
            <a className="primary-btn" href={websiteUrl("/login") ?? "/login"}>
              로그인 화면으로
            </a>
          )}
        </div>
      )}

      {pinOk && staffAuth && staff && !staff.canControl && (
        <div className="card">
          <p className="card-title">웹에서 출근 등록</p>
          <p className="muted">직원 웹의 출근 등록에서 컨트롤러 QR을 카메라로 스캔하세요.</p>
          {websiteUrl("/staff/clock-in") && (
            <a className="primary-btn" href={websiteUrl("/staff/clock-in") ?? "/staff/clock-in"}>
              출근 등록으로
            </a>
          )}
        </div>
      )}

      {ready && gameId === null && (
        <div className="game-list">
          <p className="card-title">진행 중 게임</p>
          {snapshot.sessions.length === 0 && <p className="muted">진행 중인 게임이 없습니다.</p>}
          {snapshot.sessions.map((s) => {
            const t = timers.find((x) => x.tableId === s.gameId);
            const isBreak = !!t?.blindStructureId && t.smallBlind === 0 && t.bigBlind === 0;
            return (
              <button key={s.gameId} type="button" className="game-row" onClick={() => setGameId(s.gameId)}>
                <span className="gid">G{s.gameId}</span>
                <span className="ginfo">
                  <strong>{s.structureName}</strong>
                  <small>
                    {statusLabel(t?.status)} · {isBreak ? "BREAK" : `Lv ${t?.blindLevel ?? 1}`} ·{" "}
                    {t && (t.status === "running" || t.status === "paused")
                      ? formatRemainingMs(getDisplayRemainingMs(t))
                      : "—"}
                  </small>
                </span>
              </button>
            );
          })}
        </div>
      )}

      {ready && session && (
        <GamePad
          session={session}
          timer={timer}
          moreOpen={moreOpen}
          onMore={() => setMoreOpen((v) => !v)}
          onCommand={(action, sec) => send({ type: "command", gameId: session.gameId, action, sec })}
          onCounter={(op, rebuyIndex) => send({ type: "counters", gameId: session.gameId, op, rebuyIndex })}
          onReset={() => send({ type: "command", gameId: session.gameId, action: "reset" })}
          onDelete={() => {
            send({ type: "deleteGame", gameId: session.gameId });
            setGameId(null);
            setMoreOpen(false);
          }}
        />
      )}

      {checkoutConfirm && (
        <div className="confirm-overlay" role="dialog" aria-modal="true" onClick={() => setCheckoutConfirm(false)}>
          <div className="confirm-card" onClick={(e) => e.stopPropagation()}>
            <p>퇴근하시겠습니까?</p>
            <div className="confirm-actions">
              <button type="button" className="confirm-yes" onClick={checkout}>
                예
              </button>
              <button type="button" className="confirm-no" onClick={() => setCheckoutConfirm(false)}>
                아니오
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function GamePad({
  session,
  timer,
  moreOpen,
  onMore,
  onCommand,
  onCounter,
  onReset,
  onDelete,
}: {
  session: GameSession;
  timer: TableTimerState | undefined;
  moreOpen: boolean;
  onMore: () => void;
  onCommand: (action: RemoteTimerAction, sec?: number) => void;
  onCounter: (op: RemoteCounterOp, rebuyIndex?: number) => void;
  onReset: () => void;
  onDelete: () => void;
}) {
  const remaining = timer ? getDisplayRemainingMs(timer) : 0;
  const isBreak = !!timer?.blindStructureId && timer.smallBlind === 0 && timer.bigBlind === 0;
  const running = timer?.status === "running";
  const rebuyTotal = (session.rebuys ?? []).reduce((sum, n) => sum + n, 0);

  return (
    <div className="pad">
      <div className="status">
        <p className="status-name">
          G{session.gameId} {session.structureName}
        </p>
        <div className="status-time-row">
          <p className="status-time">{formatRemainingMs(remaining)}</p>
          <div className="status-side">
            <div className="status-stat">
              <span>엔트리</span>
              <strong>{session.entries}</strong>
            </div>
            <div className="status-stat">
              <span>리바인</span>
              <strong>{rebuyTotal}</strong>
            </div>
          </div>
        </div>
        <p className="muted">
          {statusLabel(timer?.status)} · {isBreak ? "BREAK" : `레벨 ${timer?.blindLevel ?? 1}`}
          {timer && !isBreak ? ` · ${timer.smallBlind}/${timer.bigBlind}` : ""}
        </p>
      </div>

      <button type="button" className="primary-btn" onClick={() => onCommand(running ? "pause" : "start")}>
          {running ? "일시정지" : "시작"}
        </button>
      <div className="row4">
        <button type="button" onClick={() => onCommand("adjustSec", -60)}>
          −1분
        </button>
        <button type="button" onClick={() => onCommand("adjustSec", -10)}>
          −10초
        </button>
        <button type="button" onClick={() => onCommand("adjustSec", 10)}>
          +10초
        </button>
        <button type="button" onClick={() => onCommand("adjustSec", 60)}>
          +1분
        </button>
      </div>
      <div className="row2">
        <button type="button" onClick={() => onCommand("levelDown")}>
          레벨 −
        </button>
        <button type="button" onClick={() => onCommand("levelUp")}>
          레벨 +
        </button>
      </div>

      <Counter label="플레이어" value={session.players} minus="player-" plus="player+" onCounter={onCounter} />
      <Counter label="엔트리" value={session.entries} minus="entry-" plus="entry+" onCounter={onCounter} />
      {session.rebuys.map((v, i) => (
        <Counter
          key={i}
          label={session.rebuyCount === 1 ? "리바인" : `${i + 1}차 리바인`}
          value={v}
          minus="rebuy-"
          plus="rebuy+"
          index={i}
          onCounter={onCounter}
        />
      ))}
      {session.hasAddon && (
        <Counter label="애드온" value={session.addon} minus="addon-" plus="addon+" onCounter={onCounter} />
      )}
      {session.hasBonusChip && (
        <Counter label="보너스칩" value={session.bonusChip} minus="bonus-" plus="bonus+" onCounter={onCounter} />
      )}

      <button type="button" className="more-toggle" onClick={onMore}>
        기타 {moreOpen ? "▴" : "▾"}
      </button>
      {moreOpen && (
        <div className="more">
          <p className="muted">1초 길게 누르면 실행됩니다.</p>
          <LongPressButton label="리셋" sub="1초 길게" onFire={onReset} />
          <LongPressButton label="게임 종료" sub="1초 길게" onFire={onDelete} danger />
        </div>
      )}
    </div>
  );
}

function Counter({
  label,
  value,
  minus,
  plus,
  index,
  onCounter,
}: {
  label: string;
  value: number;
  minus: RemoteCounterOp;
  plus: RemoteCounterOp;
  index?: number;
  onCounter: (op: RemoteCounterOp, rebuyIndex?: number) => void;
}) {
  return (
    <div className="counter">
      <span>{label}</span>
      <div>
        <button type="button" onClick={() => onCounter(minus, index)}>
          −
        </button>
        <strong>{value}</strong>
        <button type="button" onClick={() => onCounter(plus, index)}>
          +
        </button>
      </div>
    </div>
  );
}
