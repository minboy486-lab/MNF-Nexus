"use client";

import { useCallback, useEffect, useState } from "react";
import { GUEST_NICKNAME_KEY } from "@/lib/ranking/guest-storage";

export function useGuestNickname() {
  const [nickname, setNickname] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  useEffect(() => {
    setNickname(localStorage.getItem(GUEST_NICKNAME_KEY));
    setReady(true);
  }, []);

  const saveNickname = useCallback((nick: string) => {
    localStorage.setItem(GUEST_NICKNAME_KEY, nick);
    setNickname(nick);
    setEditOpen(false);
  }, []);

  const openEdit = useCallback(() => setEditOpen(true), []);
  const closeEdit = useCallback(() => setEditOpen(false), []);

  const showNicknameModal = ready && (editOpen || !nickname);

  return {
    nickname,
    ready,
    editOpen,
    showNicknameModal,
    saveNickname,
    openEdit,
    closeEdit,
  };
}
