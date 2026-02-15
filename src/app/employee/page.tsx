import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import type { Profile, Observation } from "@/lib/types";
import EmployeeClient from "./ui";

export default async function EmployeePage() {
  const supabase = await createSupabaseServer();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("id", user.id)
    .single<Profile>();

  if (!profile) redirect("/login");
  if (profile.role !== "employee") redirect("/admin");

  const { data: rows } = await supabase
    .from("observations")
    .select("*")
    .order("created_at", { ascending: false })
    .returns<Observation[]>();

  return <EmployeeClient initialRows={rows ?? []} />;
}
