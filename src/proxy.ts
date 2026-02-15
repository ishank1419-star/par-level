import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export function proxy(request: NextRequest) {
  const res = updateSession(request);

  const pathname = request.nextUrl.pathname;

  const isProtected =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/employee");

  // middleware ما يقدر يقرأ user بسهولة بدون await معقد،
  // نخلي الحماية الأساسية داخل الصفحات server-side (أفضل).
  // هنا بس نرجع response بعد تحديث الجلسة.
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
