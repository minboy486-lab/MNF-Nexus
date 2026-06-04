import type { Seat } from "@/lib/types";
import { SeatNode } from "./SeatNode";

type Props = {
  tableCode: string;
  seats: Seat[];
  compact?: boolean;
  /** 통합 관제 뷰: 카드 영역을 최대한 채움 */
  floor?: boolean;
  /** 전체 테이블 페이지: 좌석 2배 + 테이블 내부 배치 */
  integratedFloor?: boolean;
  /** 관리자·직원 테이블: 좌석별 리바인 횟수 */
  showRebuyCount?: boolean;
  /** 타원 테이블 + 타원 좌석 배치 */
  ellipse?: boolean;
  /** 홀덤 레이스웨이 테이블 */
  holdem?: boolean;
  onSeatClick?: (seatNumber: number) => void;
};

export function PokerTableOval({
  tableCode,
  seats,
  compact,
  floor,
  integratedFloor,
  showRebuyCount,
  ellipse,
  holdem,
  onSeatClick,
}: Props) {
  const seatMap = new Map(seats.map((s) => [s.seat_number, s]));
  const useHoldem = holdem ?? false;
  const useEllipse = !useHoldem && (ellipse ?? false);
  const useCapsule = floor && !useHoldem && !useEllipse;

  return (
    <div
      className={`relative w-full h-full poker-table-surface flex items-center justify-center ${
        useHoldem
          ? "poker-table-surface--holdem"
          : useEllipse
            ? "poker-table-surface--ellipse"
            : useCapsule
              ? `poker-table-surface--capsule${integratedFloor ? " poker-table-surface--integrated-floor" : ""}`
              : "rounded-[120px]"
      } ${
        floor
          ? "min-h-0 w-full h-full"
          : compact
            ? "aspect-[2/1] max-h-48"
            : "aspect-[2/1] min-h-[200px]"
      }`}
    >
      <span
        className={`relative z-[1] opacity-10 text-primary font-black pointer-events-none ${
          floor ? "text-xl md:text-2xl" : "text-lg"
        }`}
      >
        MNF
      </span>
      {!floor && (
        <div className="seat-node seat-pos-dealer z-20 flex flex-col items-center">
          <div className="w-7 h-7 rounded-full bg-white text-black font-black flex items-center justify-center text-[8px] border-2 border-black">
            D
          </div>
        </div>
      )}
      {Array.from({ length: 11 }, (_, i) => i + 1).map((num) => (
        <SeatNode
          key={num}
          seatNumber={num}
          seat={seatMap.get(num)}
          compact={compact && !floor}
          floor={floor}
          integratedFloor={integratedFloor}
          showRebuyCount={showRebuyCount}
          ellipse={useEllipse}
          holdem={useHoldem}
          onClick={onSeatClick ? () => onSeatClick(num) : undefined}
        />
      ))}
      {!compact && !floor && (
        <span className="absolute top-2 right-3 text-[10px] font-bold text-on-surface-variant">
          {tableCode}
        </span>
      )}
    </div>
  );
}
