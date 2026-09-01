import { GuestShell } from "@/components/guest/GuestShell";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import {
  getActiveGuestVenueId,
  listGuestVenuesForUser,
} from "@/lib/guest/venue";
import { YEOKSAM_VENUE_ID } from "@/lib/venue/constants";

export default async function GuestLayout({ children }: { children: React.ReactNode }) {
  let venues: Awaited<ReturnType<typeof listGuestVenuesForUser>> = [];
  let activeVenueId = YEOKSAM_VENUE_ID;

  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      venues = await listGuestVenuesForUser(supabase, user.id);
      activeVenueId = await getActiveGuestVenueId(supabase, user.id);
    }
  }

  return (
    <GuestShell venues={venues} activeVenueId={activeVenueId}>
      {children}
    </GuestShell>
  );
}
