"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { switchPublicVenue } from "@/lib/actions/public-venue";
import type { KnownVenue } from "@/lib/venue/constants";

type Props = {
  venues: KnownVenue[];
  activeVenueId: string;
};

export function PublicVenueSwitcher({ venues, activeVenueId }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="public-venue-switcher">
      <div className="public-venue-switcher__pills" role="group" aria-label="지점 선택">
        {venues.map((v) => {
          const active = v.id === activeVenueId;
          return (
            <button
              key={v.id}
              type="button"
              disabled={pending || active}
              data-active={active}
              className="public-venue-switcher__pill"
              onClick={() => {
                if (active || pending) return;
                setError(null);
                startTransition(async () => {
                  const result = await switchPublicVenue(v.id);
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
      {error && <p className="public-venue-switcher__error">{error}</p>}
    </div>
  );
}
