export function LiveBadge() {
  return (
    <span className="live-badge inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/5 border border-primary/30 backdrop-blur-md">
      <span className="live-dot w-2 h-2 rounded-full bg-primary shrink-0" />
      <span className="text-[11px] font-bold tracking-[0.2em] text-primary uppercase">
        Live
      </span>
    </span>
  );
}
