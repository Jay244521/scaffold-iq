import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { SUPABASE_PUBLIC_URL, SUPABASE_PUBLISHABLE_KEY, isAuthConfigured } from "@/lib/supabase/config";

/** Keeps the Supabase auth cookie fresh on every request (the @supabase/ssr pattern). */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  if (!isAuthConfigured()) return response;

  const supabase = createServerClient(SUPABASE_PUBLIC_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
      },
    },
  });
  try {
    await supabase.auth.getUser();
  } catch {
    /* Supabase unreachable: serve the page; API routes re-check auth themselves */
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp|pdf)$).*)"],
};
