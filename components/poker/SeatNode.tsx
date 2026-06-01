import type { Seat } from "@/lib/types";
import { formatChips } from "@/lib/utils/format";

type Props = {
  seatNumber: number;
  seat?: Seat;
  compact?: boolean;
  onClick?: () => void;
};

export function SeatNode({ seatNumber, seat, compact, onClick }: Props) {
  const player = seat?.members;
  const occupied = Boolean(seat?.member_id);
  const name = player?.nickname ?? (occupied ? "Player" : null);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`seat-node seat-pos-${seatNumber} glass-panel rounded-lg flex flex-col items-center justify-center border transition-all ${
        occupied ? "border-primary/30" : "border-outline-variant/20 opacity-50"
      } ${onClick ? "hover:border-primary/60 cursor-pointer" : "cursor-default"}`}
    >
      {occupied && name ? (
        <>
          {!compact && seat && (
            <span className="text-[6px] font-bold text-on-surface-variant mb-0.5">
              S{seatNumber} | {formatChips(seat.chips)}
            </span>
          )}
          <span className={`font-black truncate w-full text-center ${compact ? "text-[8px]" : "text-[9px]"}`}>
            {name}
          </span>
        </>
      ) : (
        <>
          <span className="material-symbols-outlined text-primary text-sm">add_circle</span>
          {!compact && (
            <span className="text-[6px] font-bold text-primary/70 uppercase">Empty</span>
          )}
        </>
      )}
    </button>
  );
}
