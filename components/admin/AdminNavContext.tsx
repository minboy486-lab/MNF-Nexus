"use client";

import { createContext, useContext, useState, useCallback, useEffect } from "react";

type AdminNavContextValue = {
  mobileOpen: boolean;
  openMobileNav: () => void;
  closeMobileNav: () => void;
};

const AdminNavContext = createContext<AdminNavContextValue | null>(null);

export function AdminNavProvider({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const openMobileNav = useCallback(() => setMobileOpen(true), []);
  const closeMobileNav = useCallback(() => setMobileOpen(false), []);

  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  return (
    <AdminNavContext.Provider value={{ mobileOpen, openMobileNav, closeMobileNav }}>
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
