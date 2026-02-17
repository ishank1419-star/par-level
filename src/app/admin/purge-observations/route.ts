import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServer } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createSupabaseServer();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: prof } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (prof?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // 1) اجلب مسارات الصور من observations
  const { data: rows, error: selErr } = await admin
    .from("observations")
    .select("before_photo_url, after_photo_url");

  if (selErr) return NextResponse.json({ error: selErr.message }, { status: 400 });

  const paths: string[] = [];
  for (const r of rows ?? []) {
    if (r.before_photo_url) paths.push(r.before_photo_url);
    if (r.after_photo_url) paths.push(r.after_photo_url);
  }

  // 2) احذف الصور من Storage (على دفعات)
  const bucket = admin.storage.from("observations");
  const chunkSize = 100;
  for (let i = 0; i < paths.length; i += chunkSize) {
    const chunk = paths.slice(i, i + chunkSize);
    const { error } = await bucket.remove(chunk);
    if (error) {
      // ما نوقف كل شيء، بس نرجع error لو تبي
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
  }

  // 3) احذف كل السجلات من observations
  const { error: delErr } = await admin.from("observations").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 400 });

  return NextResponse.json({ ok: true, deletedPhotos: paths.length });
}
