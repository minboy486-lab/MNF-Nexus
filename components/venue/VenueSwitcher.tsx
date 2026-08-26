"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { switchActiveVenue } from "@/lib/actions/venue-context";
import { useVenueContext } from "@/components/venue/VenueContext";

type Props = {
  compact?: boolean;
  className?: string;
};

export function VenueSwitcher({ compact = false, className = "" }: Props) {
  const ctx = useVenueContext();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!ctx || ctx.venues.length === 0) return null;

  const { venues, activeVenueId } = ctx;
  const single = venues.length === 1;

  function select(venueId: string) {
    if (venueId === activeVenueId || pending) return;
    setError(null);
    startTransition(async () => {
      const result = await switchActiveVenue(venueId);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className={`venue-switcher ${compact ? "venue-switcher--compact" : ""} ${className}`.trim()}>
      <div className="venue-switcher__pills" role="group" aria-label="지점 선택">
        {venues.map((v) => {
          const active = v.id === activeVenueId;
          return (
            <button
              key={v.id}
              type="button"
              disabled={pending || (single && active)}
              data-active={active}
              className="venue-switcher__pill"
              onClick={() => select(v.id)}
            >
              {compact ? v.shortName : v.name}
            </button>
          );
        })}
      </div>
      {error && <p className="venue-switcher__error">{error}</p>}
    </div>
  );
}
