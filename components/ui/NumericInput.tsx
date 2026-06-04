"use client";

import {
  formatDecimalDisplay,
  formatIntegerDisplay,
  parseDecimalFromInput,
  parseIntegerFromInput,
} from "@/lib/utils/numeric-input";

type CommonProps = {
  id?: string;
  className?: string;
  placeholder?: string;
  "aria-label"?: string;
};

type IntegerProps = CommonProps & {
  mode?: "integer";
  value: number;
  onChange: (n: number) => void;
};

type DecimalProps = CommonProps & {
  mode: "decimal";
  value: number;
  onChange: (n: number) => void;
  max?: number;
};

export function NumericInput(props: IntegerProps | DecimalProps) {
  if (props.mode === "decimal") {
    const { value, onChange, max, id, className, placeholder, "aria-label": ariaLabel } =
      props;
    return (
      <input
        id={id}
        type="text"
        inputMode="decimal"
        value={formatDecimalDisplay(value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        onChange={(e) => {
          let n = parseDecimalFromInput(e.target.value);
          if (max != null && n > max) n = max;
          onChange(n);
        }}
        className={className}
      />
    );
  }

  const { value, onChange, id, className, placeholder, "aria-label": ariaLabel } = props;
  return (
    <input
      id={id}
      type="text"
      inputMode="numeric"
      value={formatIntegerDisplay(value)}
      placeholder={placeholder ?? "0"}
      aria-label={ariaLabel}
      onChange={(e) => onChange(parseIntegerFromInput(e.target.value))}
      className={className}
    />
  );
}
