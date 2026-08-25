"use client";

import { NumericInput } from "@/components/ui/NumericInput";
import { mpToWon, wonToMp } from "@/lib/utils/mp";

type Props = {
  id?: string;
  valueWon: number;
  onChangeWon: (won: number) => void;
  className?: string;
  "aria-label"?: string;
  emptyWhenZero?: boolean;
};

export function MpNumericInput({
  id,
  valueWon,
  onChangeWon,
  className,
  "aria-label": ariaLabel,
  emptyWhenZero,
}: Props) {
  return (
    <NumericInput
      id={id}
      mode="decimal"
      value={wonToMp(valueWon)}
      onChange={(mp) => onChangeWon(mpToWon(mp))}
      className={className}
      aria-label={ariaLabel}
      emptyWhenZero={emptyWhenZero}
    />
  );
}
