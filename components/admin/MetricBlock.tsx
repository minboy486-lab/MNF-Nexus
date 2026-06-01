type Props = {
  label: string;
  value: string;
  sub?: string;
  accent?: "primary" | "secondary" | "tertiary";
};

export function MetricBlock({ label, value, sub, accent = "primary" }: Props) {
  const accentClass =
    accent === "secondary"
      ? "text-secondary text-glow-secondary"
      : accent === "tertiary"
        ? "text-tertiary text-glow-tertiary"
        : "text-primary text-glow-primary";

  return (
    <div className="text-right">
      <p className="text-[10px] uppercase tracking-[0.15em] text-on-surface-variant/80 font-semibold">
        {label}
      </p>
      <p className={`stat-display stat-display-lg mt-0.5 ${accentClass}`}>{value}</p>
      {sub && (
        <p className={`stat-display text-base mt-0.5 ${accentClass} opacity-90`}>{sub}</p>
      )}
    </div>
  );
}
