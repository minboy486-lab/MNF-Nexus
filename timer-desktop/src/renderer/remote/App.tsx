import { useCallback, useEffect, useRef, useState } from "react";
import { formatRemainingMs, getDisplayRemainingMs } from "@mnf/timer/engine";
import { formatTimerLevelShort, resolveTimerPauseKind } from "@mnf/timer/levels";
import type { TableTimerState } from "@mnf/timer/types";
import type { AppSnapshot, GameSession } from "../../shared/types";
import type {
  RemoteClientMsg,
  RemoteCounterOp,
  RemotePeerSnapshot,
  RemoteServerMsg,
  RemoteStaffState,
  RemoteTimerAction,
} from "../../shared/remote";
import logoUrl from "./mnf-logo.png";
import { copyToClipboard, formatKakaoGameStatusFromOrigins, shareGameStatus } from "./kakaoStatus";

const LS_LOGIN = "mnf-remote-login-id";
const LS_SESSION = "mnf-remote-session";
const LS_FROM = "mnf-web-origin";
const LS_PIN = "mnf-remote-pin";

const EMPTY_SNAP: AppSnapshot = {
  sessions: [],
  monitorAssignments: {},
  tableAssignments: {},
};

function pairingFromSearch(search: string): { pin: string; tok: string; loginId: string; from: string; next: string } {
  const q = new URLSearchParams(search);
  return {
    pin: q.get("pin")?.trim() ?? "",
    tok: q.get("tok")?.trim() ?? "",
    loginId: (q.get("id") ?? q.get("login") ?? "").trim().toLowerCase(),
    from: q.get("from")?.trim() ?? "",
    next: q.get("next")?.trim() ?? "",
  };
}

function stripTokFromUrl(): void {
  const u = new URL(location.href);
  if (!u.searchParams.has("tok")) return;
  u.searchParams.delete("tok");
  history.replaceState(null, "", `${u.pathname}${u.search}${u.hash}`);
}

function storedPin(): string {
  return localStorage.getItem(LS_PIN) || "";
}

function sendStaffAuth(ws: WebSocket): void {
  const q = pairingFromSearch(location.search);
  const sessionToken = localStorage.getItem(LS_SESSION) || "";
  const loginId = q.loginId || localStorage.getItem(LS_LOGIN) || "";
  if (q.tok && loginId) {
    ws.send(JSON.stringify({ type: "claim", token: q.tok, loginId } satisfies RemoteClientMsg));
    return;
  }
  if (sessionToken) {
    ws.send(JSON.stringify({ type: "resume", sessionToken } satisfies RemoteClientMsg));
    return;
  }
  if (loginId) {
    ws.send(JSON.stringify({ type: "rejoin", loginId } satisfies RemoteClientMsg));
  }
}

function statusLabel(status: TableTimerState["status"] | undefined): string {
  if (!status || status === "stopped") return "정지";
  if (status === "running") return "진행";
  return "일시정지";
}

type GameSel = { host: string; gameId: number };

type ListedGame = {
  host: string;
  hostname: string;
  session: GameSession;
  timer: TableTimerState | undefined;
};

function listedGames(
  snapshot: AppSnapshot,
  timers: TableTimerState[],
  hostname: string,
  peers: RemotePeerSnapshot[],
): ListedGame[] {
  const rows: ListedGame[] = snapshot.sessions.map((session) => ({
    host: "",
    hostname: hostname || "이 컴퓨터",
    session,
    timer: timers.find((t) => t.tableId === session.gameId),
  }));
  for (const peer of peers) {
    for (const session of peer.snapshot.sessions) {
      rows.push({
        host: peer.host,
        hostname: peer.hostname || peer.host,
        session,
        timer: peer.timers.find((t) => t.tableId === session.gameId),
      });
    }
  }
  rows.sort((a, b) => {
    const h = a.hostname.localeCompare(b.hostname, undefined, { sensitivity: "base" });
    if (h !== 0) return h;
    return a.session.gameId - b.session.gameId;
  });
  return rows;
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
  const [pin, setPin] = useState(() => initial.pin || storedPin());
  const [tok, setTok] = useState(initial.tok);
  const [pinOk, setPinOk] = useState(false);
  const [loginId] = useState(
    () => initial.loginId || localStorage.getItem(LS_LOGIN) || "",
  );
  const [staff, setStaff] = useState<RemoteStaffState | null>(null);
  const [staffAuth, setStaffAuth] = useState<boolean | null>(null);
  const [snapshot, setSnapshot] = useState<AppSnapshot>(EMPTY_SNAP);
  const [timers, setTimers] = useState<TableTimerState[]>([]);
  const [hostname, setHostname] = useState("");
  const [peers, setPeers] = useState<RemotePeerSnapshot[]>([]);
  const [sel, setSel] = useState<GameSel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [shareFlash, setShareFlash] = useState<"shared" | "copied" | null>(null);
  const [shareSheetText, setShareSheetText] = useState<string | null>(null);
  const [, setTick] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  const pinOkRef = useRef(false);
  const clockOffsetRef = useRef(0);
  const offsetsRef = useRef<Record<string, number>>({ "": 0 });

  function applyServerNow(serverNow: number) {
    clockOffsetRef.current = serverNow - Date.now();
  }

  function remainingOf(timer: TableTimerState | undefined, host = ""): number {
    if (!timer) return 0;
    return getDisplayRemainingMs(timer, Date.now() + (offsetsRef.current[host] ?? clockOffsetRef.current));
  }

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
        if (typeof msg.serverNow === "number") applyServerNow(msg.serverNow);
        localStorage.setItem(LS_PIN, nextPin);
        if (msg.staffAuth) sendStaffAuth(ws);
        return;
      }
      if (msg.type === "hello_fail") {
        pinOkRef.current = false;
        setPinOk(false);
        setError(msg.error);
        return;
      }
      if (msg.type === "staff") {
        if (msg.sessionToken) localStorage.setItem(LS_SESSION, msg.sessionToken);
        else localStorage.removeItem(LS_SESSION);
        if (msg.staff.loginId) localStorage.setItem(LS_LOGIN, msg.staff.loginId);
        setStaff(msg.staff.loginId || msg.staff.name ? msg.staff : null);
        setError(null);
        if (msg.staff.canControl) {
          setTok("");
          stripTokFromUrl();
          if (initial.next === "staff") {
            const home = websiteUrl("/staff");
            if (home) {
              window.location.replace(home);
              return;
            }
          }
        }
        return;
      }
      if (msg.type === "snapshot") {
        if (typeof msg.serverNow === "number") applyServerNow(msg.serverNow);
        const nextOffsets: Record<string, number> = { "": clockOffsetRef.current };
        for (const peer of msg.peers ?? []) {
          nextOffsets[peer.host] = (typeof peer.serverNow === "number" ? peer.serverNow : Date.now()) - Date.now();
        }
        offsetsRef.current = nextOffsets;
        setSnapshot(msg.snapshot);
        setTimers(msg.timers);
        setHostname(msg.hostname ?? "");
        setPeers(msg.peers ?? []);
        return;
      }
      if (msg.type === "error") {
        if (msg.error.includes("세션이 만료")) {
          localStorage.removeItem(LS_SESSION);
          const q = pairingFromSearch(location.search);
          const loginId = q.loginId || localStorage.getItem(LS_LOGIN) || "";
          if (q.tok && loginId) {
            ws.send(JSON.stringify({ type: "claim", token: q.tok, loginId } satisfies RemoteClientMsg));
            return;
          }
          if (loginId) {
            ws.send(JSON.stringify({ type: "rejoin", loginId } satisfies RemoteClientMsg));
            return;
          }
        }
        if (msg.error.includes("QR이 만료")) {
          setTok("");
          stripTokFromUrl();
          const loginId =
            pairingFromSearch(location.search).loginId || localStorage.getItem(LS_LOGIN) || "";
          if (loginId) {
            ws.send(JSON.stringify({ type: "rejoin", loginId } satisfies RemoteClientMsg));
            return;
          }
        }
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
    if (initial.pin) localStorage.setItem(LS_PIN, initial.pin);
    if (initial.loginId) localStorage.setItem(LS_LOGIN, initial.loginId);
    const nextPin = initial.pin || storedPin();
    if (nextPin) connect(nextPin);
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
    if (!sel) return;
    const stillThere = listedGames(snapshot, timers, hostname, peers).some(
      (g) => g.host === sel.host && g.session.gameId === sel.gameId,
    );
    if (!stillThere) setSel(null);
  }, [sel, snapshot, timers, hostname, peers]);

  function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{4}$/.test(pin)) {
      setError("PIN 4자리를 입력하세요.");
      return;
    }
    localStorage.setItem(LS_PIN, pin);
    connect(pin);
  }

  function flashShare(kind: "shared" | "copied") {
    setShareFlash(kind);
    window.setTimeout(() => setShareFlash(null), 1600);
  }

  async function shareKakaoStatus() {
    const text = formatKakaoGameStatusFromOrigins([
      { snapshot, timers },
      ...peers.map((p) => ({ snapshot: p.snapshot, timers: p.timers })),
    ]);
    const result = await shareGameStatus(text);
    if (result === "cancelled") return;
    if (result === "sheet") {
      setShareSheetText(text);
      setError(null);
      return;
    }
    setError(null);
    flashShare("shared");
  }

  async function copyShareSheet() {
    if (!shareSheetText) return;
    const ok = await copyToClipboard(shareSheetText);
    if (!ok) {
      setError("복사에 실패했습니다. 다시 눌러 주세요.");
      return;
    }
    setShareSheetText(null);
    setError(null);
    flashShare("copied");
  }

  async function openKakaoFromSheet() {
    if (!shareSheetText) return;
    const ok = await copyToClipboard(shareSheetText);
    setShareSheetText(null);
    if (ok) flashShare("copied");
    window.location.assign("kakaotalk://");
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
    setSel(null);
    setTok("");
  }

  const games = listedGames(snapshot, timers, hostname, peers);
  const showHosts = peers.length > 0;
  const selected = sel ? games.find((g) => g.host === sel.host && g.session.gameId === sel.gameId) ?? null : null;
  const session = selected?.session ?? null;
  const timer = selected?.timer;
  const ready = pinOk && (staffAuth === false || !!staff?.canControl);
  const goingHome = initial.next === "staff";
  const hostField = selected?.host ? { host: selected.host } : {};

  return (
    <div className="remote">
      <header className="remote-header">
        {ready && selected ? (
          <button
            type="button"
            className="games-list-btn"
            onClick={() => {
              setSel(null);
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
        {ready && !goingHome && (
          <button type="button" className="kakao-share-btn" onClick={() => void shareKakaoStatus()}>
            {shareFlash === "shared" ? "공유됨" : shareFlash === "copied" ? "복사됨" : "카톡 공유"}
          </button>
        )}
      </header>

      {error && <p className="remote-error">{error}</p>}

      {!pinOk && staff && <p className="muted">컨트롤러에 다시 연결하는 중...</p>}

      {!pinOk && !staff && (
        <form className="card" onSubmit={handleConnect}>
          <p className="card-title">컨트롤러 연결</p>
          <p className="muted">같은 Wi-Fi에서 한 번만 QR을 스캔하면, 퇴근 전까지 다시 찍지 않아도 됩니다.</p>
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

      {pinOk && staffAuth && !staff && loginId && (
        <p className="muted">출근 연결 중...</p>
      )}

      {pinOk && staffAuth && !staff && !loginId && (
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

      {goingHome && pinOk && !error && (
        <p className="muted">출근 등록 중...</p>
      )}

      {ready && !selected && !goingHome && (
        <div className="game-list">
          <p className="card-title">진행 중 게임</p>
          {games.length === 0 && <p className="muted">진행 중인 게임이 없습니다.</p>}
          {games.map((g) => {
            const t = g.timer;
            return (
              <button
                key={`${g.host}:${g.session.gameId}`}
                type="button"
                className="game-row"
                onClick={() => setSel({ host: g.host, gameId: g.session.gameId })}
              >
                <span className="gid">G{g.session.gameId}</span>
                <span className="ginfo">
                  <strong>{g.session.structureName}</strong>
                  {showHosts && g.hostname ? <span className="ghost">{g.hostname}</span> : null}
                  <small>
                    {statusLabel(t?.status)} · {formatTimerLevelShort(t)} ·{" "}
                    {t && (t.status === "running" || t.status === "paused")
                      ? formatRemainingMs(remainingOf(t, g.host))
                      : "—"}
                  </small>
                </span>
              </button>
            );
          })}
        </div>
      )}

      {ready && session && selected && !goingHome && (
        <GamePad
          session={session}
          timer={timer}
          remainingMs={remainingOf(timer, selected.host)}
          originLabel={showHosts ? selected.hostname : ""}
          moreOpen={moreOpen}
          onMore={() => setMoreOpen((v) => !v)}
          onCommand={(action, sec) =>
            send({ type: "command", gameId: session.gameId, action, sec, ...hostField })
          }
          onCounter={(op, rebuyIndex) =>
            send({ type: "counters", gameId: session.gameId, op, rebuyIndex, ...hostField })
          }
          onReset={() => send({ type: "command", gameId: session.gameId, action: "reset", ...hostField })}
          onDelete={() => {
            send({ type: "deleteGame", gameId: session.gameId, ...hostField });
            setSel(null);
            setMoreOpen(false);
          }}
        />
      )}

      {shareSheetText != null && (
        <div
          className="share-sheet-backdrop"
          role="presentation"
          onClick={() => setShareSheetText(null)}
        >
          <div
            className="share-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="share-sheet-title"
            onClick={(e) => e.stopPropagation()}
          >
            <p id="share-sheet-title" className="share-sheet__title">
              카톡 공유
            </p>
            <p className="share-sheet__hint">카카오톡으로 보내거나, 복사해서 붙여넣을 수 있습니다.</p>
            <button type="button" className="share-sheet__kakao" onClick={() => void openKakaoFromSheet()}>
              카카오톡
            </button>
            <button type="button" className="share-sheet__copy" onClick={() => void copyShareSheet()}>
              복사
            </button>
            <button type="button" className="share-sheet__cancel" onClick={() => setShareSheetText(null)}>
              취소
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function GamePad({
  session,
  timer,
  remainingMs,
  originLabel,
  moreOpen,
  onMore,
  onCommand,
  onCounter,
  onReset,
  onDelete,
}: {
  session: GameSession;
  timer: TableTimerState | undefined;
  remainingMs: number;
  originLabel?: string;
  moreOpen: boolean;
  onMore: () => void;
  onCommand: (action: RemoteTimerAction, sec?: number) => void;
  onCounter: (op: RemoteCounterOp, rebuyIndex?: number) => void;
  onReset: () => void;
  onDelete: () => void;
}) {
  const remaining = remainingMs;
  const pauseKind = resolveTimerPauseKind(timer);
  const running = timer?.status === "running";
  const rebuyTotal = (session.rebuys ?? []).reduce((sum, n) => sum + n, 0);

  return (
    <div className="pad">
      <div className="status">
        <p className="status-name">
          G{session.gameId} {session.structureName}
        </p>
        {originLabel ? <p className="muted">{originLabel}</p> : null}
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
          {statusLabel(timer?.status)} · {formatTimerLevelShort(timer, "레벨")}
          {timer && !pauseKind ? ` · ${timer.smallBlind}/${timer.bigBlind}` : ""}
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
