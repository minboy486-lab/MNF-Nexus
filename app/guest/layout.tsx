import { GuestNav } from "@/components/guest/GuestNav";
import { signOut } from "@/lib/actions/auth";

export default function GuestLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh flex flex-col max-w-lg mx-auto w-full relative">
      <div className="bg-mesh" aria-hidden />
      <header className="sticky top-0 z-40 glass-header px-4 py-3 flex justify-between items-center">
        <p className="font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
          MNF · 손님
        </p>
        <form action={signOut}>
          <button type="submit" className="text-xs text-on-surface-variant hover:text-primary transition-colors">
            로그아웃
          </button>
        </form>
      </header>
      <main className="relative z-10 flex-1 overflow-y-auto p-4 pb-24">{children}</main>
      <GuestNav />
    </div>
  );
}
