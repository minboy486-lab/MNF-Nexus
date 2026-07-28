import Image from "next/image";
import { MNF_LOGO_HORIZONTAL, MNF_LOGO_SQUARE } from "@/lib/brand/logos";

type Props = {
  variant: "square" | "horizontal";
  className?: string;
  priority?: boolean;
  size?: "sm" | "lg";
};

const SIZES = {
  square: {
    sm: { width: 96, height: 96, className: "h-10 w-10" },
    lg: { width: 160, height: 160, className: "h-24 w-24" },
  },
  horizontal: {
    sm: { width: 200, height: 48, className: "h-8 w-auto max-w-[9.5rem] sm:max-w-[11rem]" },
    lg: { width: 707, height: 354, className: "login-brand-logo" },
  },
} as const;

export function MnfLogo({ variant, className = "", priority, size = "sm" }: Props) {
  const src = variant === "square" ? MNF_LOGO_SQUARE : MNF_LOGO_HORIZONTAL;
  const logoSize = SIZES[variant][size];

  return (
    <Image
      src={src}
      alt="MNF HOLDEM"
      width={logoSize.width}
      height={logoSize.height}
      className={`object-contain object-left ${logoSize.className} ${className}`.trim()}
      priority={priority}
      unoptimized
    />
  );
}
