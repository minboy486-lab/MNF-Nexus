"use client";

import { createContext, useContext } from "react";
import type { KnownVenue } from "@/lib/venue/constants";

type VenueContextValue = {
  venues: KnownVenue[];
  activeVenueId: string;
};

const VenueContext = createContext<VenueContextValue | null>(null);

export function VenueProvider({
  venues,
  activeVenueId,
  children,
}: {
  venues: KnownVenue[];
  activeVenueId: string;
  children: React.ReactNode;
}) {
  return (
    <VenueContext.Provider value={{ venues, activeVenueId }}>
      {children}
    </VenueContext.Provider>
  );
}

export function useVenueContext(): VenueContextValue | null {
  return useContext(VenueContext);
}
