import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export default function Home() {
  if (!isSupabaseConfigured()) {
    redirect("/admin/dashboard");
  }
  redirect("/login");
}
