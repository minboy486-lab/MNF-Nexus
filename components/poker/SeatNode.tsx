import { seatEllipseStyle } from "@/lib/poker/seat-ellipse";
import { seatHoldemStyle } from "@/lib/poker/seat-holdem";
import { seatIntegratedStyle } from "@/lib/poker/seat-integrated";
import type { Seat } from "@/lib/types";
import { formatChips } from "@/lib/utils/format";

type Props = {
  seatNumber: number;
  seat?: Seat;
  compact?: boolean;
  floor?: boolean;
  /** 통합 테이블 뷰: 좌석 2배 + 테이블 내부 배치 */
  integratedFloor?: boolean;
  /** 관리자·직원: 좌석별 리바인 횟수 */
  showRebuyCount?: boolean;
  ellipse?: boolean;
  holdem?: boolean;
  onClick?: () => void;
};

export function SeatNode({
  seatNumber,
  seat,
  compact,
  floor,
  integratedFloor,
  showRebuyCount,
  ellipse,
  holdem,
  onClick,
}: Props) {
  const player = seat?.members;
  const occupied = Boolean(seat?.member_id);
  const name = player?.nickname ?? (occupied ? "Player" : null);
  const posStyle = holdem
    ? seatHoldemStyle(seatNumber)
    : ellipse
      ? seatEllipseStyle(seatNumber)
      : undefined;
  const posClass =
    posStyle || integratedFloor
      ? ""
      : `seat-pos-${seatNumber}`;
  const integratedPosClass = integratedFloor && !posStyle ? `seat-pos-in-${seatNumber}` : "";

  return (
    <button
      type="button"
      onClick={onClick}
      style={posStyle}
      className={`seat-node ${posClass} glass-panel rounded-lg flex flex-col items-center justify-center border transition-all ${
        integratedFloor ? "seat-node--integrated" : floor ? "min-w-[2.5rem] min-h-[2.25rem]" : ""
      } ${
        occupied ? "border-primary/30" : "border-outline-variant/20 opacity-70"
      } ${onClick ? "hover:border-primary/60 hover:opacity-100 cursor-pointer" : "cursor-default"}`}
    >
      {occupied && name ? (
        <>
          {!compact && seat && (
            <span
              className={`font-bold text-on-surface-variant mb-0.5 leading-tight ${
                integratedFloor ? "text-[8px] sm:text-[9px] max-w-full truncate px-0.5" : "text-[6px]"
              }`}
            >
              S{seatNumber} | {formatChips(seat.chips)}
              {showRebuyCount && (
                <span className="text-secondary/90"> · RB{seat.rebuy_count ?? 0}</span>
              )}
            </span>
          )}
          <span
            className={`font-black truncate w-full text-center ${
              integratedFloor
                ? "text-[10px] sm:text-xs max-w-full truncate px-0.5 leading-tight"
                : floor
                  ? "text-[9px] md:text-[10px]"
                  : compact
                    ? "text-[8px]"
                    : "text-[9px]"
            }`}
          >
            {name}
          </span>
          {player && player.credit_balance < 0 && (
            <span className={`text-error font-bold ${compact ? "text-[7px]" : "text-[8px]"}`}>
              {player.credit_balance.toLocaleString()}
            </span>
          )}
        </>
      ) : (
        <>
          <span
            className={`material-symbols-outlined text-primary ${
              integratedFloor ? "text-2xl md:text-3xl" : floor ? "text-base" : "text-sm"
            }`}
          >
            add_circle
          </span>
          {!compact && !floor && (
            <span className="text-[6px] font-bold text-primary/70 uppercase">Empty</span>
          )}
        </>
      )}
    </button>
  );
}
