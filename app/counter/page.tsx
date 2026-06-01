import Link from "next/link";
import { CounterClient } from "@/components/counter/CounterClient";
import { getOpenVenueSession } from "@/lib/data/queries";
import { LiveBadge } from "@/components/admin/LiveBadge";

export const dynamic = "force-dynamic";

export default async function CounterPage() {
  const session = await getOpenVenueSession();

  return (
    <div className="min-h-dvh flex flex-col relative">
      <div className="bg-mesh" aria-hidden />
      <header className="glass-header relative z-10 px-4 py-4 flex justify-between items-center">
        <div>
          <p className="font-bold text-lg bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            MNF · 접수대
          </p>
          <p className="text-xs text-on-surface-variant font-medium mt-0.5">전화 조회 · 방문 자동 등록</p>
        </div>
        <div className="flex items-center gap-3">
          <LiveBadge />
          <Link href="/admin/dashboard" className="text-sm text-on-surface-variant hover:text-primary transition-colors">
            관리자
          </Link>
        </div>
      </header>
      <main className="relative z-10 flex-1 p-4 md:p-6 overflow-y-auto">
        <CounterClient session={session} />
      </main>
    </div>
  );
}
