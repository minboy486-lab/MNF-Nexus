"use client";

export function PublicGuestProfileChip({
  nickname,
  onClick,
}: {
  nickname: string | null;
  onClick: () => void;
}) {
  if (nickname) {
    return (
      <button type="button" onClick={onClick} className="public-ranking-profile-chip">
        <span className="public-ranking-profile-avatar" aria-hidden>
          <span className="material-symbols-outlined">person</span>
        </span>
        <span className="public-ranking-profile-text">
          <span className="public-ranking-profile-label">내 닉네임</span>
          <span className="public-ranking-profile-name">{nickname}</span>
        </span>
        <span className="material-symbols-outlined public-ranking-profile-edit" aria-hidden>
          edit
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="public-ranking-profile-chip public-ranking-profile-chip-empty"
    >
      <span className="public-ranking-profile-avatar" aria-hidden>
        <span className="material-symbols-outlined">person_add</span>
      </span>
      <span className="public-ranking-profile-text">
        <span className="public-ranking-profile-label">닉네임</span>
        <span className="public-ranking-profile-name">터치해서 입력</span>
      </span>
    </button>
  );
}
