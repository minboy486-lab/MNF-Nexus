import { AdminTopBar } from "@/components/admin/AdminTopBar";
import { EventsWheelClient } from "@/components/events/EventsWheelClient";
import { getMembers } from "@/lib/data/queries";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

export default async function EventsPage() {
  const members = await getMembers();

  return (
    <>
      <AdminTopBar title="이벤트" subtitle="돌림판 · 뽑기" />
      <div className="admin-main flex-1 overflow-y-auto p-6 md:p-8">
        <EventsWheelClient
          memberNames={members.map((m) => m.nickname)}
          seatNumbers={Array.from({ length: 11 }, (_, i) => i + 1)}
        />
      </div>
    </>
  );
}
