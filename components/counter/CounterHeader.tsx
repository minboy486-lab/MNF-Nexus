import Link from "next/link";
import { LiveBadge } from "@/components/admin/LiveBadge";
import { signOut } from "@/lib/actions/auth";
import { isCounterRole } from "@/lib/auth/routes";

type Props = {
  role: string | null;
};

export function CounterHeader({ role }: Props) {
  const counterOnly = isCounterRole(role);

  return (
    <header className="glass-header relative z-10 px-4 py-4 flex justify-between items-center">
      <div>
        <p className="font-bold text-lg bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
          MNF · 접수대
        </p>
        <p className="text-xs text-on-surface-variant font-medium mt-0.5">전화 조회 · 방문 자동 등록</p>
      </div>
      <div className="flex items-center gap-3">
        <LiveBadge />
        {!counterOnly && (
          <Link
            href="/admin/dashboard"
            className="text-sm text-on-surface-variant hover:text-primary transition-colors"
          >
            관리자
          </Link>
        )}
        <form action={signOut}>
          <button
            type="submit"
            className="text-sm text-on-surface-variant hover:text-primary transition-colors"
          >
            로그아웃
          </button>
        </form>
      </div>
    </header>
  );
}
