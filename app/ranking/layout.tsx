import { PublicGuestNav } from "@/components/ranking/PublicGuestNav";

export default function PublicRankingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh flex flex-col max-w-lg mx-auto w-full relative">
      <div className="bg-mesh" aria-hidden />
      <main className="relative z-10 flex-1 overflow-y-auto px-4 py-5 pb-24">{children}</main>
      <PublicGuestNav />
    </div>
  );
}
