"use client";

import { useEffect, useRef, useState } from "react";

export function GuestNicknameModal({
  initial,
  onSave,
  onClose,
}: {
  initial: string;
  onSave: (nick: string) => void;
  onClose?: () => void;
}) {
  const [value, setValue] = useState(initial);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const nick = value.trim();
    if (!nick) return;
    onSave(nick);
  }

  return (
    <div className="public-ranking-modal-backdrop" role="dialog" aria-modal="true">
      <div className="public-ranking-modal">
        <h2 className="text-lg font-bold text-center mb-1">닉네임 설정</h2>
        <p className="text-xs text-on-surface-variant text-center mb-5">
          매장에서 사용하는 닉네임을 입력하세요
        </p>
        <form onSubmit={submit} className="space-y-4">
          <label className="block text-xs text-on-surface-variant">
            닉네임
            <input
              ref={inputRef}
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="닉네임을 입력하세요"
              className="login-input w-full mt-1.5 text-base py-3"
              autoComplete="nickname"
              maxLength={32}
            />
          </label>
          <div className="flex gap-2">
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 rounded-xl border border-white/15 text-sm font-semibold text-on-surface-variant hover:bg-white/5"
              >
                취소
              </button>
            )}
            <button
              type="submit"
              disabled={!value.trim()}
              className="flex-1 btn-primary py-3 rounded-xl text-sm font-bold disabled:opacity-40"
            >
              저장
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
