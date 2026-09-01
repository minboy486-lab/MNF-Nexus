import { GuestNav } from "@/components/guest/GuestNav";

export default function GuestLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="guest-shell min-h-dvh flex flex-col max-w-lg mx-auto w-full relative isolate">
      <div className="bg-mesh" aria-hidden />
      <header className="guest-shell__header sticky top-0 z-50 border-b border-white/10 bg-surface/90 backdrop-blur-md px-4 flex items-center shrink-0">
        <p className="font-bold text-base bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
          MNF HOLDEM
        </p>
      </header>
      <main className="relative z-10 flex-1 overflow-y-auto overflow-x-hidden px-4 pt-4 guest-shell__main">
        {children}
      </main>
      <GuestNav />
    </div>
  );
}
