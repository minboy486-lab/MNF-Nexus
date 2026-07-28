"use client";

import { useEffect } from "react";
import {
  getMsUntilNextVenueRollover,
  getVenueOperatingDate,
} from "@/lib/venue/operating-date";

/** URL에 date 없을 때 17:00 KST 롤오버에 맞춰 자동 갱신 */
export function useVenueOperatingDateRollover(
  playDate: string,
  hasDateInUrl: boolean,
  onRollover: () => void,
) {
  useEffect(() => {
    if (hasDateInUrl) return;

    function check() {
      if (getVenueOperatingDate() !== playDate) {
        onRollover();
      }
    }

    const timeoutId = window.setTimeout(check, getMsUntilNextVenueRollover());
    const intervalId = window.setInterval(check, 60_000);

    return () => {
      window.clearTimeout(timeoutId);
      window.clearInterval(intervalId);
    };
  }, [playDate, hasDateInUrl, onRollover]);
}
