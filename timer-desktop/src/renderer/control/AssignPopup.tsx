import { useEffect, useRef } from "react";
import type { GameSession } from "../../shared/types";

type Props = {
  title: string;
  mousePos: { x: number; y: number };
  currentGameId: number | null;
  sessions: GameSession[];
  onSelect: (gameId: number | null) => void;
  onClose: () => void;
  hint?: string;
};

export function AssignPopup({
  title,
  mousePos,
  currentGameId,
  sessions,
  onSelect,
  onClose,
  hint,
}: Props) {
  const popupRef = useRef<HTMLDivElement>(null);

  const GAP = 12;
  const POPUP_W = 280;
  const estimatedH = 56 + (sessions.length + 1) * 54;

  // 커서 오른쪽 아래 기준, 화면 밖으로 나가면 반대 방향
  let left = mousePos.x + GAP;
  let top = mousePos.y + GAP;

  if (left + POPUP_W > window.innerWidth - 8) left = mousePos.x - POPUP_W - GAP;
  if (top + estimatedH > window.innerHeight - 8) top = mousePos.y - estimatedH - GAP;
  left = Math.max(8, left);
  top = Math.max(8, top);

  // 숫자 키 단축키
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "0") { onSelect(null); return; }
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= 9) {
        const s = sessions[n - 1];
        if (s) onSelect(s.gameId);
      }
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [sessions, onSelect, onClose]);

  return (
    <div className="popup-overlay" onClick={onClose}>
      <div
        ref={popupRef}
        className="popup popup--anchored"
        style={{ left, top, width: POPUP_W, minWidth: POPUP_W }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="popup__header">
          <div>
            <span>{title}</span>
            {hint && <span className="popup__hint">{hint}</span>}
          </div>
          <button type="button" className="popup__close" onClick={onClose}>✕</button>
        </div>

        {sessions.length === 0 ? (
          <p className="popup__empty">진행 중인 게임 없음</p>
        ) : (
          <ul className="popup__list">
            {sessions.map((s, i) => {
              const key = i < 9 ? i + 1 : null;
              return (
                <li
                  key={s.gameId}
                  className={`popup__item ${currentGameId === s.gameId ? "popup__item--active" : ""}`}
                  onClick={() => onSelect(s.gameId)}
                >
                  {key && <span className="popup__key">{key}</span>}
                  <span>G{s.gameId} — {s.structureName}</span>
                </li>
              );
            })}
          </ul>
        )}

        {/* 해제는 항상 맨 아래 */}
        <div className="popup__divider" />
        <ul className="popup__list">
          <li
            className={`popup__item ${currentGameId === null ? "popup__item--active" : ""}`}
            onClick={() => onSelect(null)}
          >
            <span className="popup__key popup__key--zero">0</span>
            <span>연결 해제</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
