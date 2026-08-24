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

const EMPTY_SNAP: AppSnapshot = {
  sessions: [],
  monitorAssignments: {},
  tableAssignments: {},
};

function pairingFromSearch(search: string): { pin: string; tok: string; loginId: string } {
  const q = new URLSearchParams(search);
  return {
    pin: q.get("pin")?.trim() ?? "",
    tok: q.get("tok")?.trim() ?? "",
    loginId: (q.get("id") ?? q.get("login") ?? "").trim().toLowerCase(),
  };
}

function parseQrPayload(text: string): { pin?: string; tok?: string } {
  try {
    const u = new URL(text.trim());
    return {
      pin: u.searchParams.get("pin") ?? undefined,
      tok: u.searchParams.get("tok") ?? undefined,
    };
  } catch {
    const t = text.trim();
    if (/^[A-Za-z0-9_-]{8,}$/.test(t)) return { tok: t };
    return {};
  }
}

async function decodeQrFile(file: File): Promise<string | null> {
  const bmp = await createImageBitmap(file);
  try {
    const Detector = (window as unknown as { BarcodeDetector?: new (opts: { formats: string[] }) => { detect: (src: ImageBitmap) => Promise<Array<{ rawValue?: string }>> } }).BarcodeDetector;
    if (Detector) {
      const codes = await new Detector({ formats: ["qr_code"] }).detect(bmp);
      if (codes[0]?.rawValue) return codes[0].rawValue;
    }
  } catch {
    /* jsQR fallback */
  }
  const canvas = document.createElement("canvas");
  canvas.width = bmp.width;
  canvas.height = bmp.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(bmp, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { default: jsQR } = await import("jsqr");
  return jsQR(imageData.data, imageData.width, imageData.height)?.data ?? null;
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
  const [loginId, setLoginId] = useState(
    () => initial.loginId || localStorage.getItem(LS_LOGIN) || "",
  );
  const [password, setPassword] = useState("");
  const [staff, setStaff] = useState<RemoteStaffState | null>(null);
  const [staffAuth, setStaffAuth] = useState<boolean | null>(null);
  const [snapshot, setSnapshot] = useState<AppSnapshot>(EMPTY_SNAP);
  const [timers, setTimers] = useState<TableTimerState[]>([]);
  const [gameId, setGameId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [, setTick] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  const pinOkRef = useRef(false);

  const send = useCallback((msg: RemoteClientMsg) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  }, []);

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
    ws.onclose = () => {
      const wasOk = pinOkRef.current;
      pinOkRef.current = false;
      setPinOk(false);
      if (!wasOk) return;
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

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    send({ type: "login", loginId, password });
    window.setTimeout(() => setBusy(false), 800);
  }

  async function handleScanFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const raw = await decodeQrFile(file);
      if (!raw) {
        setError("QR을 읽지 못했습니다. 다시 촬영해 주세요.");
        return;
      }
      const parsed = parseQrPayload(raw);
      if (parsed.pin && parsed.pin !== pin) {
        setPin(parsed.pin);
        connect(parsed.pin);
      }
      if (parsed.tok) setTok(parsed.tok);
      else setError("출근용 QR이 아닙니다.");
    } catch {
      setError("QR 인식에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  function checkout() {
    send({ type: "checkout" });
    setGameId(null);
    setTok("");
  }

  function logout() {
    send({ type: "logout" });
    localStorage.removeItem(LS_SESSION);
    setStaff(null);
    setPassword("");
    setGameId(null);
    setTok("");
  }

  const session = snapshot.sessions.find((s) => s.gameId === gameId) ?? null;
  const timer = timers.find((t) => t.tableId === gameId);
  const ready = pinOk && (staffAuth === false || !!staff?.canControl);

  return (
    <div className="remote">
      <header className="remote-header">
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
        {staff && staffAuth !== false && (
          <button type="button" className="text-btn" onClick={staff.canControl ? checkout : logout}>
            {staff.canControl ? "퇴근" : "로그아웃"}
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

      {pinOk && staffAuth && !staff && (
        <form className="card" onSubmit={handleLogin}>
          <p className="card-title">직원 로그인</p>
          <input
            className="field"
            autoComplete="username"
            value={loginId}
            onChange={(e) => setLoginId(e.target.value)}
            placeholder="아이디"
          />
          <input
            className="field"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="비밀번호"
          />
          <button type="submit" className="primary-btn" disabled={busy}>
            로그인
          </button>
        </form>
      )}

      {pinOk && staffAuth && staff && !staff.canControl && (
        <div className="card">
          <p className="card-title">출근 QR 스캔</p>
          <p className="muted">컨트롤러 왼쪽 위 MNF 로고를 눌러 띄운 QR을 촬영하세요.</p>
          <label className="primary-btn scan-label">
            QR 촬영
            <input
              type="file"
              accept="image/*"
              capture="environment"
              hidden
              onChange={(e) => void handleScanFile(e.target.files?.[0])}
            />
          </label>
          {staff.checkedIn && (
            <p className="muted">이미 출근 상태입니다. QR을 찍으면 리모컨 권한이 부여됩니다.</p>
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
          onBack={() => {
            setGameId(null);
            setMoreOpen(false);
          }}
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
    </div>
  );
}

function GamePad({
  session,
  timer,
  moreOpen,
  onBack,
  onMore,
  onCommand,
  onCounter,
  onReset,
  onDelete,
}: {
  session: GameSession;
  timer: TableTimerState | undefined;
  moreOpen: boolean;
  onBack: () => void;
  onMore: () => void;
  onCommand: (action: RemoteTimerAction, sec?: number) => void;
  onCounter: (op: RemoteCounterOp, rebuyIndex?: number) => void;
  onReset: () => void;
  onDelete: () => void;
}) {
  const remaining = timer ? getDisplayRemainingMs(timer) : 0;
  const isBreak = !!timer?.blindStructureId && timer.smallBlind === 0 && timer.bigBlind === 0;
  const running = timer?.status === "running";

  return (
    <div className="pad">
      <button type="button" className="text-btn back" onClick={onBack}>
        ← 게임 목록
      </button>
      <div className="status">
        <p className="status-name">
          G{session.gameId} {session.structureName}
        </p>
        <p className="status-time">{formatRemainingMs(remaining)}</p>
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
