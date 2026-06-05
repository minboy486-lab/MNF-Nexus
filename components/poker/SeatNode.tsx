import { seatEllipseStyle } from "@/lib/poker/seat-ellipse";
import { seatHoldemStyle } from "@/lib/poker/seat-holdem";
import { seatIntegratedStyle } from "@/lib/poker/seat-integrated";
import { getPaymentMethodLabel, seatBuyInCount } from "@/lib/ledger/payment-methods";
import type { Seat } from "@/lib/types";

type Props = {
  seatNumber: number;
  seat?: Seat;
  compact?: boolean;
  floor?: boolean;
  /** 통합 테이블 뷰: 타원 배치 + SEAT 라벨 */
  integratedFloor?: boolean;
  ellipse?: boolean;
  holdem?: boolean;
  onClick?: () => void;
};

function OccupiedSeatContent({
  name,
  seat,
  integratedFloor,
  floor,
  compact,
}: {
  name: string;
  seat: Seat;
  integratedFloor?: boolean;
  floor?: boolean;
  compact?: boolean;
}) {
  const paymentLabel = getPaymentMethodLabel(
    seat.first_payment_method ?? seat.last_payment_method,
  );
  const buyInCount = seatBuyInCount(seat);

  return (
    <>
      <span
        className={`font-black truncate w-full text-center leading-tight ${
          integratedFloor
            ? "text-[11px] sm:text-sm max-w-full px-0.5"
            : floor
              ? "text-[10px] md:text-xs"
              : compact
                ? "text-[9px]"
                : "text-[10px]"
        }`}
      >
        {name}
      </span>
      {!compact && (
        <span
          className={`font-semibold text-on-surface-variant truncate w-full text-center leading-tight mt-0.5 ${
            integratedFloor ? "text-[7px] sm:text-[8px] max-w-full px-0.5" : "text-[7px]"
          }`}
        >
          {paymentLabel} | 바인횟수 : {buyInCount} 회
        </span>
      )}
    </>
  );
}

export function SeatNode({
  seatNumber,
  seat,
  compact,
  floor,
  integratedFloor,
  ellipse,
  holdem,
  onClick,
}: Props) {
  const player = seat?.members;
  const occupied = Boolean(seat?.member_id);
  const name = player?.nickname ?? (occupied ? "Player" : null);

  const posStyle = holdem
    ? seatHoldemStyle(seatNumber)
    : integratedFloor
      ? seatIntegratedStyle(seatNumber)
      : ellipse
        ? seatEllipseStyle(seatNumber)
        : undefined;

  const posClass = posStyle ? "" : `seat-pos-${seatNumber}`;

  const seatButton = (
    <button
      type="button"
      onClick={onClick}
      className={`seat-node glass-panel rounded-lg flex flex-col items-center justify-center border transition-all ${
        integratedFloor ? "seat-node--integrated relative" : floor ? "min-w-[2.5rem] min-h-[2.25rem]" : ""
      } ${
        occupied ? "border-primary/30" : "border-outline-variant/20 opacity-70"
      } ${onClick ? "hover:border-primary/60 hover:opacity-100 cursor-pointer" : "cursor-default"}`}
    >
      {occupied && name && seat ? (
        <OccupiedSeatContent
          name={name}
          seat={seat}
          integratedFloor={integratedFloor}
          floor={floor}
          compact={compact}
        />
      ) : (
        <>
          <span
            className={`material-symbols-outlined text-primary ${
              integratedFloor ? "text-xl sm:text-2xl" : floor ? "text-base" : "text-sm"
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

  if (integratedFloor && posStyle) {
    return (
      <div className="seat-integrated-wrap absolute z-[3]" style={posStyle}>
        <div className="seat-integrated-anchor relative w-fit pointer-events-none">
          <div className="pointer-events-auto">{seatButton}</div>
          <span className="seat-integrated-label absolute left-1/2 top-full -translate-x-1/2 text-[8px] sm:text-[9px] font-bold text-on-surface-variant/90 tracking-wide whitespace-nowrap pointer-events-none">
            SEAT #{seatNumber}
          </span>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      style={posStyle}
      className={`seat-node ${posClass} glass-panel rounded-lg flex flex-col items-center justify-center border transition-all ${
        floor ? "min-w-[2.5rem] min-h-[2.25rem]" : ""
      } ${
        occupied ? "border-primary/30" : "border-outline-variant/20 opacity-70"
      } ${onClick ? "hover:border-primary/60 hover:opacity-100 cursor-pointer" : "cursor-default"}`}
    >
      {occupied && name && seat ? (
        <OccupiedSeatContent
          name={name}
          seat={seat}
          floor={floor}
          compact={compact}
        />
      ) : (
        <>
          <span
            className={`material-symbols-outlined text-primary ${floor ? "text-base" : "text-sm"}`}
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
