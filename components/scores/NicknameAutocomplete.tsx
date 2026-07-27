"use client";

import { useMemo, useState } from "react";
import type { MemberSuggestion } from "@/lib/scores/types";

type Props = {
  members: MemberSuggestion[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  id?: string;
};

export function NicknameAutocomplete({
  members,
  value,
  onChange,
  disabled,
  id = "score-nickname",
}: Props) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);

  const suggestions = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return members.slice(0, 12);
    return members
      .filter(
        (m) =>
          m.nickname.toLowerCase().includes(q) ||
          m.display_name?.toLowerCase().includes(q),
      )
      .slice(0, 12);
  }, [members, value]);

  function pick(nickname: string) {
    onChange(nickname);
    setOpen(false);
  }

  return (
    <div className="relative">
      <input
        id={id}
        type="text"
        value={value}
        disabled={disabled}
        autoComplete="off"
        placeholder="닉네임"
        className="login-input w-full text-sm"
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setHighlight(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (!open || suggestions.length === 0) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlight((h) => (h + 1) % suggestions.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlight((h) => (h - 1 + suggestions.length) % suggestions.length);
          } else if (e.key === "Enter" && suggestions[highlight]) {
            e.preventDefault();
            pick(suggestions[highlight].nickname);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {open && suggestions.length > 0 && (
        <ul className="absolute z-50 left-0 right-0 mt-1 max-h-48 overflow-y-auto rounded-lg border border-white/15 bg-[#1a1820] shadow-xl py-1">
          {suggestions.map((m, i) => (
            <li key={m.id}>
              <button
                type="button"
                className={`w-full text-left px-3 py-2 text-sm ${
                  i === highlight ? "bg-primary/15 text-primary" : "hover:bg-white/5"
                }`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(m.nickname)}
              >
                <span className="font-semibold">{m.nickname}</span>
                {m.display_name && (
                  <span className="text-on-surface-variant ml-1.5 text-xs">
                    ({m.display_name})
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
