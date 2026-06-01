import type { Seat } from "@/lib/types";
import { SeatNode } from "./SeatNode";

type Props = {
  tableCode: string;
  seats: Seat[];
  compact?: boolean;
  onSeatClick?: (seatNumber: number) => void;
};

export function PokerTableOval({ tableCode, seats, compact, onSeatClick }: Props) {
  const seatMap = new Map(seats.map((s) => [s.seat_number, s]));

  return (
    <div
      className={`relative w-full poker-table-surface rounded-[120px] flex items-center justify-center ${
        compact ? "aspect-[2/1] max-h-48" : "aspect-[2/1] min-h-[200px]"
      }`}
    >
      <span className="opacity-10 text-primary font-black text-lg pointer-events-none">
        MNF
      </span>
      <div className="seat-node seat-pos-dealer z-20 flex flex-col items-center">
        <div className="w-7 h-7 rounded-full bg-white text-black font-black flex items-center justify-center text-[8px] border-2 border-black">
          D
        </div>
      </div>
      {Array.from({ length: 11 }, (_, i) => i + 1).map((num) => (
        <SeatNode
          key={num}
          seatNumber={num}
          seat={seatMap.get(num)}
          compact={compact}
          onClick={onSeatClick ? () => onSeatClick(num) : undefined}
        />
      ))}
      {!compact && (
        <span className="absolute top-2 right-3 text-[10px] font-bold text-on-surface-variant">
          {tableCode}
        </span>
      )}
    </div>
  );
}
