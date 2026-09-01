"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { switchGuestVenue } from "@/lib/actions/guest-venue";
import type { KnownVenue } from "@/lib/venue/constants";

type Props = {
  venues: KnownVenue[];
  activeVenueId: string;
};

export function GuestVenueSwitcher({ venues, activeVenueId }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (venues.length === 0) return null;

  if (venues.length === 1) {
    const v = venues[0];
    return (
      <span className="guest-venue-badge" aria-label={`지점 ${v.name}`}>
        {v.shortName}
      </span>
    );
  }

  return (
    <div className="guest-venue-switcher">
      <div className="guest-venue-switcher__pills" role="group" aria-label="지점 선택">
        {venues.map((v) => {
          const active = v.id === activeVenueId;
          return (
            <button
              key={v.id}
              type="button"
              disabled={pending || active}
              data-active={active}
              className="guest-venue-switcher__pill"
              onClick={() => {
                if (active || pending) return;
                setError(null);
                startTransition(async () => {
                  const result = await switchGuestVenue(v.id);
                  if ("error" in result) {
                    setError(result.error);
                    return;
                  }
                  router.refresh();
                });
              }}
            >
              {v.shortName}
            </button>
          );
        })}
      </div>
      {error && <p className="guest-venue-switcher__error">{error}</p>}
    </div>
  );
}
