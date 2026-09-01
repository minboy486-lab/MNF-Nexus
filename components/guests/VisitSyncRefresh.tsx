"use client";

import { useVisitSync } from "@/lib/guests/use-visit-sync";

export function VisitSyncRefresh({ venueId }: { venueId: string }) {
  useVisitSync(venueId);
  return null;
}
