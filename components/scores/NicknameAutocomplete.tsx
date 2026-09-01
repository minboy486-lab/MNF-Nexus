"use client";

import { useMemo, useState } from "react";
import { sortMembersByVisitCount, type MemberSuggestion } from "@/lib/scores/types";
import { matchesNicknameSearch } from "@/lib/utils/chosung";

type Props = {
  members: MemberSuggestion[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  id?: string;
  placeholder?: string;
  inputClassName?: string;
  onEnter?: () => void;
  onPick?: (member: MemberSuggestion) => void;
  /** true면 자동완성 목록과 관계없이 Enter 시 onEnter 호출 */
  enterSubmits?: boolean;
};

export function NicknameAutocomplete({
  members,
  value,
  onChange,
  disabled,
  id = "score-nickname",
  placeholder = "닉네임 검색 (초성 가능)",
  inputClassName,
  onEnter,
  onPick,
  enterSubmits = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);

  const suggestions = useMemo(() => {
    const q = value.trim();
    const matched = q
      ? members.filter(
          (m) =>
            matchesNicknameSearch(m.nickname, q) ||
            (m.display_name ? matchesNicknameSearch(m.display_name, q) : false),
        )
      : members;
    return sortMembersByVisitCount(matched).slice(0, 12);
  }, [members, value]);

  function pick(member: MemberSuggestion) {
    onChange(member.nickname);
    onPick?.(member);
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
        placeholder={placeholder}
        className={`login-input w-full text-sm ${inputClassName ?? ""}`}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setHighlight(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && open && suggestions.length > 0) {
            e.preventDefault();
            setHighlight((h) => (h + 1) % suggestions.length);
          } else if (e.key === "ArrowUp" && open && suggestions.length > 0) {
            e.preventDefault();
            setHighlight((h) => (h - 1 + suggestions.length) % suggestions.length);
          } else if (e.key === "Enter") {
            if (enterSubmits && onEnter && value.trim()) {
              e.preventDefault();
              setOpen(false);
              onEnter();
            } else if (open && suggestions.length > 0 && suggestions[highlight]) {
              e.preventDefault();
              pick(suggestions[highlight]);
            } else if (onEnter && value.trim()) {
              e.preventDefault();
              onEnter();
            }
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
                onClick={() => pick(m)}
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
