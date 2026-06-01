import { isSupabaseConfigured } from "@/lib/supabase/env";
import { LiveBadge } from "@/components/admin/LiveBadge";

type Props = {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
};

export function AdminTopBar({ title, subtitle, children }: Props) {
  return (
    <header className="glass-header sticky top-0 z-30 flex items-center justify-between px-6 py-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-primary via-white to-secondary bg-clip-text text-transparent">
          {title}
        </h1>
        {subtitle && (
          <p className="text-on-surface-variant/90 text-sm mt-1 font-medium">{subtitle}</p>
        )}
      </div>
      <div className="flex items-center gap-3">
        {!isSupabaseConfigured() && (
          <span className="text-xs px-3 py-1.5 rounded-full bg-white/5 border border-tertiary/30 text-tertiary backdrop-blur-md">
            데모 모드
          </span>
        )}
        <LiveBadge />
        {children}
      </div>
    </header>
  );
}
