"use client";

import { createContext, useContext, useState, useCallback, useEffect } from "react";

type AdminNavContextValue = {
  navOpen: boolean;
  toggleNav: () => void;
  openNav: () => void;
  closeNav: () => void;
};

const AdminNavContext = createContext<AdminNavContextValue | null>(null);

export function AdminNavProvider({ children }: { children: React.ReactNode }) {
  const [navOpen, setNavOpen] = useState(true);

  const toggleNav = useCallback(() => setNavOpen((open) => !open), []);
  const openNav = useCallback(() => setNavOpen(true), []);
  const closeNav = useCallback(() => setNavOpen(false), []);

  useEffect(() => {
    if (!navOpen) return;
    const mq = window.matchMedia("(max-width: 767px)");
    if (!mq.matches) return;

    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [navOpen]);

  return (
    <AdminNavContext.Provider value={{ navOpen, toggleNav, openNav, closeNav }}>
      {children}
    </AdminNavContext.Provider>
  );
}

export function useAdminNav() {
  const ctx = useContext(AdminNavContext);
  if (!ctx) {
    throw new Error("useAdminNav must be used within AdminNavProvider");
  }
  return ctx;
}

/** AdminShell 밖(직원 테이블 등) — 없으면 undefined */
export function useAdminNavOptional() {
  return useContext(AdminNavContext);
}
