import Link from "next/link";

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-surface flex flex-col">
      <header className="border-b border-outline-variant/30 px-4 py-3 flex justify-between items-center">
        <Link href="/staff/games" className="font-bold text-primary">
          MNF · 직원
        </Link>
        <Link href="/admin/dashboard" className="text-xs text-on-surface-variant">
          관리자
        </Link>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
