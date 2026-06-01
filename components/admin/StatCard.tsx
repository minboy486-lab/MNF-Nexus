type Props = {
  label: string;
  value: string | number;
  accent?: "primary" | "secondary" | "tertiary" | "default";
};

export function StatCard({ label, value, accent = "default" }: Props) {
  const valueClass =
    accent === "primary"
      ? "text-primary text-glow-primary"
      : accent === "secondary"
        ? "text-secondary text-glow-secondary"
        : accent === "tertiary"
          ? "text-tertiary text-glow-tertiary"
          : "text-on-surface";

  const borderAccent =
    accent === "primary"
      ? "border-t-primary/50"
      : accent === "secondary"
        ? "border-t-secondary/50"
        : accent === "tertiary"
          ? "border-t-tertiary/50"
          : "border-t-white/10";

  return (
    <div
      className={`glass-panel rounded-2xl p-5 border-t-2 ${borderAccent} glass-panel-hover`}
    >
      <p className="text-[10px] uppercase font-semibold text-on-surface-variant tracking-[0.18em] mb-2">
        {label}
      </p>
      <p className={`stat-display stat-display-xl ${valueClass}`}>{value}</p>
    </div>
  );
}
