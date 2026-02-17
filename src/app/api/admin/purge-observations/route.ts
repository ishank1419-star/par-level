import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServer } from "@/lib/supabase/server";

function toStoragePath(v: string) {
  // لو كان رابط كامل، نستخرج الجزء بعد /object/.../observations/
  // مثال:
  // https://xxxx.supabase.co/storage/v1/object/public/observations/before/abc.png
  // أو signed url:
  // .../storage/v1/object/sign/observations/before/abc.png?token=...
  try {
    if (!v.startsWith("http")) return v; // غالبًا path جاهز

    const u = new URL(v);
    const s = u.pathname; // "/storage/v1/object/...."
    const idx = s.indexOf("/observations/");
    if (idx === -1) return v; // ما نعرف نطلع path
    return s.slice(idx + "/observations/".length); // "before/abc.png"
  } catch {
    return v;
  }
}

export async function POST() {
  const supabase = await createSupabaseServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: prof } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (prof?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Service role (يتجاوز RLS)
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  // 1) اجلب مسارات الصور
  const { data: rows, error: selErr } = await admin
    .from("observations")
    .select("before_photo_url, after_photo_url");

  if (selErr) return NextResponse.json({ error: selErr.message }, { status: 400 });

  // 2) نظّف المسارات + شيل التكرار
  const set = new Set<string>();

  for (const r of rows ?? []) {
    if (r.before_photo_url) set.add(toStoragePath(String(r.before_photo_url)).trim());
    if (r.after_photo_url) set.add(toStoragePath(String(r.after_photo_url)).trim());
  }

  // حذف أي قيم غريبة/فاضية
  const paths = Array.from(set).filter((p) => p && !p.startsWith("http"));

  // 3) احذف الصور من Storage (دفعات)
  let deletedPhotos = 0;
  const bucket = admin.storage.from("observations");
  const chunkSize = 100;

  for (let i = 0; i < paths.length; i += chunkSize) {
    const chunk = paths.slice(i, i + chunkSize);
    const { error } = await bucket.remove(chunk);
    if (error) {
      return NextResponse.json({ error: error.message, at: { i, chunkSize } }, { status: 400 });
    }
    deletedPhotos += chunk.length;
  }

  // 4) احذف كل السجلات من observations
  // (Supabase يحتاج فلتر، فنستخدم neq hack)
  const { error: delErr } = await admin
    .from("observations")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");

  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 400 });

  return NextResponse.json({ ok: true, deletedPhotos });
}
