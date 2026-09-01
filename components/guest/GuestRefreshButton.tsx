"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

type Props = {
  label?: string;
  className?: string;
};

export function GuestRefreshButton({ label = "새로고침", className = "" }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => router.refresh())}
      className={`inline-flex items-center justify-center w-9 h-9 rounded-xl border border-white/12 bg-white/[0.04] text-on-surface-variant hover:text-on-surface hover:border-white/20 transition-colors disabled:opacity-50 ${className}`}
      aria-label={label}
      title={label}
    >
      <span
        className={`material-symbols-outlined text-[1.25rem] ${pending ? "animate-spin" : ""}`}
        aria-hidden
      >
        refresh
      </span>
    </button>
  );
}
