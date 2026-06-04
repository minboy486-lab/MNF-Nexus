import { CounterClient } from "@/components/counter/CounterClient";
import { CounterHeader } from "@/components/counter/CounterHeader";
import { getOpenVenueSession } from "@/lib/data/queries";
import { createClient } from "@/lib/supabase/server";
import { isCounterRole } from "@/lib/auth/routes";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function CounterPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if (!isCounterRole(profile?.role) && profile?.role !== "admin" && profile?.role !== "staff") {
      redirect("/login");
    }
  }

  const session = await getOpenVenueSession();
  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).single()
    : { data: null };

  return (
    <div className="min-h-dvh flex flex-col relative">
      <div className="bg-mesh" aria-hidden />
      <CounterHeader role={profile?.role ?? null} />
      <main className="relative z-10 flex-1 p-4 md:p-6 overflow-y-auto max-w-lg mx-auto w-full">
        <CounterClient session={session} />
      </main>
    </div>
  );
}
