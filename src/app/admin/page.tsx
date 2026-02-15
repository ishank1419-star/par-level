import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import type { Profile, Observation } from "@/lib/types";
import AdminClient from "./ui";

export default async function AdminPage() {
  const supabase = await createSupabaseServer();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("id", user.id)
    .single<Profile>();

  if (!profile) redirect("/login");
  if (profile.role !== "admin") redirect("/employee");

  const { data: rows } = await supabase
    .from("observations")
    .select("*")
    .order("created_at", { ascending: false })
    .returns<Observation[]>();

  // احصائيات من RPC لو طبقتها:
  const { data: stats } = await supabase.rpc("admin_stats");

  // قائمة الموظفين للأدمن يختار owner_user_id عند الإضافة
  const { data: employees } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .order("full_name", { ascending: true })
    .returns<Profile[]>();

  return <AdminClient initialRows={rows ?? []} initialStats={stats ?? null} employees={employees ?? []} />;
}
