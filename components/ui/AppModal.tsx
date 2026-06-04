"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

type Accent = "tertiary" | "primary";

type Props = {
  onClose: () => void;
  title: string;
  subtitle?: string;
  eyebrow?: string;
  accent?: Accent;
  maxWidth?: "md" | "lg" | "xl" | "2xl";
  children: ReactNode;
  footer?: ReactNode;
  titleId?: string;
};

const maxWidthClass = {
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
} as const;

const accentBarClass: Record<Accent, string> = {
  tertiary: "bg-tertiary",
  primary: "bg-primary",
};

export function AppModal({
  onClose,
  title,
  subtitle,
  eyebrow,
  accent = "tertiary",
  maxWidth = "lg",
  children,
  footer,
  titleId = "app-modal-title",
}: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!mounted) return null;

  return createPortal(
    <div
      className="app-modal-backdrop fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={onClose}
    >
      <div
        className={`app-modal-panel w-full ${maxWidthClass[maxWidth]} rounded-2xl overflow-hidden my-auto shrink-0`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="app-modal-header flex items-start justify-between gap-3 px-5 sm:px-6 pt-5 sm:pt-6 pb-4">
          <div className="min-w-0 flex-1">
            {eyebrow && (
              <p className="text-[10px] uppercase tracking-[0.2em] text-primary/80 font-semibold mb-1">
                {eyebrow}
              </p>
            )}
            <h2
              id={titleId}
              className="text-xl font-bold tracking-tight flex items-center gap-2.5"
            >
              <span
                className={`w-1 h-5 rounded-full shrink-0 ${accentBarClass[accent]}`}
                aria-hidden
              />
              {title}
            </h2>
            {subtitle && (
              <p className="mt-2 text-xs text-on-surface-variant leading-relaxed pl-3.5">
                {subtitle}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="app-modal-close shrink-0"
            aria-label="닫기"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        <div className="app-modal-body px-5 sm:px-6 py-1 sm:py-2">{children}</div>

        {footer && (
          <div className="app-modal-footer px-5 sm:px-6 py-4 sm:py-5 flex gap-3">{footer}</div>
        )}
      </div>
    </div>,
    document.body,
  );
}
