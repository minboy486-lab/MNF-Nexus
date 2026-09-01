import { useCallback, useEffect, useMemo, useState } from "react";
import type { MemberSummary, SessionGuest } from "../../preload/control";

type Props = {
  onBack: () => void;
  activeGameCount: number;
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const hours = d.getHours();
  const period = hours < 12 ? "오전" : "오후";
  const hour12 = String(hours % 12 || 12).padStart(2, "0");
  const minute = String(d.getMinutes()).padStart(2, "0");
  return `${period} ${hour12}:${minute}`;
}

export function AttendanceView({ onBack, activeGameCount }: Props) {
  const [tab, setTab] = useState<"floor" | "register">("floor");
  const [sessionOpen, setSessionOpen] = useState<boolean | null>(null);
  const [guests, setGuests] = useState<SessionGuest[]>([]);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<MemberSummary[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");

  const refreshSession = useCallback(async () => {
    const res = await window.controlApi.getVenueSession();
    if (res.ok) setSessionOpen(!!res.session);
    else setSessionOpen(false);
  }, []);

  const refreshGuests = useCallback(async () => {
    const res = await window.controlApi.listSessionGuests();
    if (res.ok) setGuests(res.guests);
    else if (res.error) setError(res.error);
  }, []);

  useEffect(() => {
    void refreshSession();
    void refreshGuests();
  }, [refreshSession, refreshGuests]);

  const onFloorIds = useMemo(() => new Set(guests.filter((g) => g.onFloor).map((g) => g.memberId)), [guests]);
  const activeCount = guests.filter((g) => g.onFloor).length;

  const runSearch = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    setError(null);
    const res = await window.controlApi.searchAttendanceMembers(trimmed);
    setSearching(false);
    if (!res.ok) {
      setError(res.error);
      setSearchResults([]);
      return;
    }
    setSearchResults(res.members);
    if (res.members.length === 0) {
      setError("등록된 손님이 없습니다. 신규 등록에서 추가해 주세요.");
    }
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    const timer = window.setTimeout(() => {
      void runSearch(query);
    }, 280);
    return () => window.clearTimeout(timer);
  }, [query, runSearch]);

  async function handleCloseSession() {
    if (activeGameCount > 0) {
      setError(`진행 중인 게임이 ${activeGameCount}개 있습니다. 게임을 모두 종료한 뒤 영업을 마감해 주세요.`);
      return;
    }
    if (!window.confirm("영업을 종료하시겠습니까? 재실 중인 손님은 모두 퇴장 처리됩니다.")) return;
    setPending(true);
    setError(null);
    const res = await window.controlApi.closeVenueSession();
    setPending(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setSessionOpen(false);
    setGuests([]);
    setQuery("");
    setSearchResults([]);
  }

  async function handleOpenSession() {
    setPending(true);
    setError(null);
    const res = await window.controlApi.openVenueSession();
    setPending(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    await refreshSession();
    await refreshGuests();
  }

  async function handleCheckIn(memberId: string) {
    setPending(true);
    setError(null);
    const res = await window.controlApi.checkInAttendance(memberId);
    setPending(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setQuery("");
    setSearchResults([]);
    await refreshGuests();
  }

  async function handleCheckOut(visitId: string) {
    setPending(true);
    setError(null);
    const res = await window.controlApi.checkOutAttendance(visitId);
    setPending(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    await refreshGuests();
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const res = await window.controlApi.createAttendanceMember({
      loginId,
      password,
      nickname,
      displayName: displayName || undefined,
      phone: phone || undefined,
    });
    setPending(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setLoginId("");
    setPassword("");
    setNickname("");
    setDisplayName("");
    setPhone("");
    setTab("floor");
    setQuery(res.member.nickname);
    setSearchResults([res.member]);
    if (sessionOpen) await handleCheckIn(res.member.id);
  }

  function handleSearchKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      void runSearch(query);
    }
  }

  return (
    <section className="attendance-view">
      <header className="attendance-view__head">
        <div className="attendance-view__head-left">
          <button type="button" className="page-back-btn" onClick={onBack}>
            ← 뒤로
          </button>
          <h2 className="attendance-view__title">매장 관리</h2>
        </div>
        {sessionOpen === false && (
          <button
            type="button"
            className="attendance-view__open"
            disabled={pending}
            onClick={() => void handleOpenSession()}
          >
            영업 시작
          </button>
        )}
        {sessionOpen && (
          <div className="attendance-view__session-actions">
            <span className="attendance-view__badge">영업 중</span>
            <button
              type="button"
              className="attendance-view__close"
              disabled={pending || activeGameCount > 0}
              title={
                activeGameCount > 0
                  ? `진행 중인 게임 ${activeGameCount}개 — 모두 종료 후 마감 가능`
                  : undefined
              }
              onClick={() => void handleCloseSession()}
            >
              영업 종료
            </button>
          </div>
        )}
      </header>

      {sessionOpen === false && (
        <p className="attendance-view__notice muted">
          영업을 시작하면 손님 체크인·퇴장을 할 수 있습니다.
        </p>
      )}
      {sessionOpen && activeGameCount > 0 && (
        <p className="attendance-view__notice muted">
          진행 중인 게임 {activeGameCount}개 — 영업 종료는 모든 게임 종료 후 가능합니다.
        </p>
      )}

      {error && <p className="error attendance-view__error">{error}</p>}

      <div className="attendance-tabs">
        <button
          type="button"
          className={`attendance-tabs__btn${tab === "floor" ? " attendance-tabs__btn--active" : ""}`}
          onClick={() => setTab("floor")}
        >
          출석 목록 ({activeCount})
        </button>
        <button
          type="button"
          className={`attendance-tabs__btn${tab === "register" ? " attendance-tabs__btn--active" : ""}`}
          onClick={() => setTab("register")}
        >
          신규 등록
        </button>
      </div>

      {tab === "floor" && (
        <div className="attendance-panel">
          <div className="attendance-search">
            <input
              className="attendance-search__input"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (error) setError(null);
              }}
              onKeyDown={handleSearchKeyDown}
              placeholder="닉네임·아이디·초성 검색 (예: ㅋㄹ, 콜라)"
              disabled={!sessionOpen || pending}
            />
            <button
              type="button"
              className="attendance-search__btn"
              disabled={!sessionOpen || !query.trim() || pending || searching}
              onClick={() => void runSearch(query)}
            >
              {searching ? "조회 중…" : "조회"}
            </button>
          </div>

          {searchResults.length > 0 && (
            <div className="attendance-search-results">
              <h3 className="attendance-search-results__title">검색 결과</h3>
              <ul className="attendance-search-results__grid">
                {searchResults.map((m) => {
                  const onFloor = onFloorIds.has(m.id);
                  return (
                    <li
                      key={m.id}
                      className={`attendance-search-results__item${onFloor ? " attendance-search-results__item--on-floor" : ""}`}
                    >
                      <div className="attendance-search-results__info">
                        <strong>{m.nickname}</strong>
                        <span className="muted">{m.login_id}</span>
                      </div>
                      {onFloor ? (
                        <span className="attendance-search-results__status">출석 중</span>
                      ) : (
                        <button
                          type="button"
                          className="attendance-result__checkin"
                          disabled={!sessionOpen || pending}
                          onClick={() => void handleCheckIn(m.id)}
                        >
                          체크인
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <div className="attendance-list-head">
            <h3 className="attendance-list-head__title">오늘 출석</h3>
            <span className="muted attendance-list-head__count">
              {activeCount}명 재실 · 총 {guests.length}명
            </span>
          </div>

          {guests.length === 0 ? (
            <p className="muted attendance-list__empty">아직 출석한 손님이 없습니다.</p>
          ) : (
            <ul className="attendance-list attendance-list--grid">
              {guests.map((g) => (
                <li
                  key={g.visitId}
                  className={`attendance-list__item${g.onFloor ? "" : " attendance-list__item--left"}`}
                >
                  <div className="attendance-list__main">
                    <strong>{g.nickname}</strong>
                    {g.displayName ? <span className="muted"> · {g.displayName}</span> : null}
                    <span className="attendance-list__time">
                      {g.onFloor
                        ? formatTime(g.checkedInAt)
                        : `퇴장 ${g.checkedOutAt ? formatTime(g.checkedOutAt) : ""}`}
                    </span>
                  </div>
                  {g.onFloor ? (
                    <button
                      type="button"
                      className="attendance-list__out"
                      disabled={pending}
                      onClick={() => void handleCheckOut(g.visitId)}
                    >
                      퇴장
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="attendance-list__reentry"
                      disabled={pending || !sessionOpen}
                      onClick={() => void handleCheckIn(g.memberId)}
                    >
                      재입장
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === "register" && (
        <form className="attendance-panel attendance-form" onSubmit={(e) => void handleRegister(e)}>
          <p className="muted attendance-form__hint">
            신규 손님 등록 후 영업 중이면 자동으로 체크인됩니다.
          </p>
          <div className="attendance-form__grid">
            <label className="attendance-label">
              아이디 *
              <input
                className="attendance-input"
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                required
                minLength={3}
                autoComplete="off"
              />
            </label>
            <label className="attendance-label">
              비밀번호 *
              <input
                className="attendance-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={4}
                autoComplete="new-password"
              />
            </label>
            <label className="attendance-label">
              닉네임 *
              <input
                className="attendance-input"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                required
              />
            </label>
            <label className="attendance-label">
              이름
              <input
                className="attendance-input"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </label>
            <label className="attendance-label attendance-form__full">
              전화번호
              <input
                className="attendance-input"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                inputMode="tel"
              />
            </label>
          </div>
          <button
            type="submit"
            className="settings-popup__btn settings-popup__btn--active"
            disabled={pending || !sessionOpen}
          >
            등록{sessionOpen ? " · 체크인" : ""}
          </button>
        </form>
      )}
    </section>
  );
}
