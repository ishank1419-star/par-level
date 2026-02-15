import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import type { Profile, Observation } from "@/lib/types";
import AdminStatsClient from "./ui";

export default async function AdminStatsPage() {
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

  // Employees
  const { data: employees } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("role", "employee")
    .order("full_name", { ascending: true })
    .returns<Profile[]>();

  // Observations (كل البيانات للأدمن)
  const { data: rows } = await supabase
    .from("observations")
    .select("*")
    .order("created_at", { ascending: false })
    .returns<Observation[]>();

  return <AdminStatsClient employees={employees ?? []} rows={rows ?? []} />;
}
