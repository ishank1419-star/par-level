import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

export default async function DashboardRouter() {
  const supabase = await createSupabaseServer();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("id", user.id)
    .single<Profile>();

  if (error || !profile) {
    // إذا ما فيه profile (نسيته تنشئه) رجّع login أو صفحة خطأ
    redirect("/login");
  }

  if (profile.role === "admin") redirect("/admin");
  redirect("/employee");
}
