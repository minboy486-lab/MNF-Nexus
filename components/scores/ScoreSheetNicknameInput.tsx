"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { sortMembersByVisitCount, type MemberSuggestion } from "@/lib/scores/types";
import { matchesNicknameSearch } from "@/lib/utils/chosung";

type Props = {
  members: MemberSuggestion[];
  value: string;
  onChange: (value: string) => void;
  onEnterNext: () => void;
  onArrowNav: (direction: "up" | "down" | "left" | "right") => void;
  onFocus?: () => void;
  disabled?: boolean;
  gameNo: number;
  rowIndex: number;
  rowId: string;
  openRowId: string | null;
  onOpenChange: (rowId: string | null) => void;
};

export function ScoreSheetNicknameInput({
  members,
  value,
  onChange,
  onEnterNext,
  onArrowNav,
  onFocus,
  disabled,
  gameNo,
  rowIndex,
  rowId,
  openRowId,
  onOpenChange,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [highlight, setHighlight] = useState(0);
  const [usedKeyboardNav, setUsedKeyboardNav] = useState(false);
  const [menuRect, setMenuRect] = useState<DOMRect | null>(null);

  const open = openRowId === rowId;

  const suggestions = useMemo(() => {
    const q = value.trim();
    if (!q) return [];
    return sortMembersByVisitCount(
      members.filter(
        (m) =>
          matchesNicknameSearch(m.nickname, q) ||
          (m.display_name ? matchesNicknameSearch(m.display_name, q) : false),
      ),
    ).slice(0, 10);
  }, [members, value]);

  function syncMenuRect() {
    const el = inputRef.current;
    if (!el) return;
    setMenuRect(el.getBoundingClientRect());
  }

  function showMenu() {
    if (value.trim().length === 0) {
      onOpenChange(null);
      return;
    }
    onOpenChange(rowId);
    syncMenuRect();
    setHighlight(0);
    setUsedKeyboardNav(false);
  }

  function hideMenu() {
    if (openRowId === rowId) onOpenChange(null);
  }

  function pick(nickname: string) {
    onChange(nickname);
    hideMenu();
  }

  function advanceNext() {
    hideMenu();
    window.setTimeout(() => onEnterNext(), 0);
  }

  useEffect(() => {
    if (!open) return;
    syncMenuRect();
    const onScroll = () => syncMenuRect();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open, value]);

  useEffect(() => {
    if (open && suggestions.length === 0) hideMenu();
  }, [open, suggestions.length]);

  return (
    <>
      <input
        ref={inputRef}
        type="text"
        value={value}
        disabled={disabled}
        autoComplete="off"
        data-game={gameNo}
        data-row={rowIndex}
        data-col="nickname"
        className="score-sheet-input"
        onChange={(e) => {
          onChange(e.target.value);
          if (e.target.value.trim().length > 0) {
            onOpenChange(rowId);
            syncMenuRect();
            setHighlight(0);
            setUsedKeyboardNav(false);
          } else {
            hideMenu();
          }
        }}
        onFocus={() => {
          onFocus?.();
          if (value.trim().length > 0) showMenu();
        }}
        onBlur={() => window.setTimeout(() => hideMenu(), 120)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && open && suggestions.length > 0) {
            e.preventDefault();
            setUsedKeyboardNav(true);
            setHighlight((h) => (h + 1) % suggestions.length);
            return;
          }
          if (e.key === "ArrowUp" && open && suggestions.length > 0) {
            e.preventDefault();
            setUsedKeyboardNav(true);
            setHighlight((h) => (h - 1 + suggestions.length) % suggestions.length);
            return;
          }
          if (e.key === "ArrowRight") {
            e.preventDefault();
            hideMenu();
            onArrowNav("right");
            return;
          }
          if (e.key === "ArrowLeft") {
            e.preventDefault();
            hideMenu();
            onArrowNav("left");
            return;
          }
          if (e.key === "ArrowDown") {
            e.preventDefault();
            hideMenu();
            onArrowNav("down");
            return;
          }
          if (e.key === "ArrowUp") {
            e.preventDefault();
            hideMenu();
            onArrowNav("up");
            return;
          }
          if (e.key === "Enter") {
            e.preventDefault();
            e.stopPropagation();
            const q = value.trim().toLowerCase();
            const exact = suggestions.find((m) => m.nickname.toLowerCase() === q);
            if (exact) {
              pick(exact.nickname);
            } else if (usedKeyboardNav && suggestions[highlight]) {
              pick(suggestions[highlight].nickname);
            }
            advanceNext();
            return;
          }
          if (e.key === "Escape") {
            e.preventDefault();
            hideMenu();
          }
        }}
      />
      {open &&
        suggestions.length > 0 &&
        menuRect &&
        createPortal(
          <ul
            className="score-nickname-menu fixed z-[200] max-h-40 overflow-y-auto rounded-md border border-white/15 bg-[#1a1820] shadow-xl py-0.5"
            style={{
              top: menuRect.bottom + 2,
              left: menuRect.left,
              minWidth: Math.max(menuRect.width, 120),
            }}
            onMouseDown={(e) => e.preventDefault()}
          >
            {suggestions.map((m, i) => (
              <li key={m.id}>
                <button
                  type="button"
                  className={`w-full text-left px-2 py-1 text-[11px] leading-tight ${
                    i === highlight ? "bg-primary/15 text-primary" : "hover:bg-white/5"
                  }`}
                  onMouseEnter={() => setHighlight(i)}
                  onClick={() => {
                    pick(m.nickname);
                    advanceNext();
                  }}
                >
                  <span className="font-semibold">{m.nickname}</span>
                  {m.display_name && (
                    <span className="text-on-surface-variant ml-1 text-[10px]">
                      {m.display_name}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>,
          document.body,
        )}
    </>
  );
}
