"use client";

import Link from "next/link";

type Props = {
  href?: string;
  label?: string;
};

export function StaffBackLink({ href = "/staff", label = "뒤로" }: Props) {
  return (
    <Link
      href={href}
      aria-label="뒤로가기"
      className="inline-flex items-center gap-1.5 h-11 px-3.5 -ml-1 rounded-xl text-sm font-bold text-primary border border-primary/45 bg-primary/15 shadow-sm active:scale-[0.96] active:bg-primary/25 transition-transform"
    >
      <span className="material-symbols-outlined text-[22px] leading-none" aria-hidden>
        arrow_back
      </span>
      {label}
    </Link>
  );
}
