import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { guardRequest } from "@/lib/server/request-guard";
import { cleanText, validateEmail, validatePassword } from "@/lib/auth/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/auth/signup
 * Body: { companyName, fullName, email, password }
 *
 * Creates a company (organizations), its first user (confirmed, so no email
 * round-trip is needed) and that user's technician profile with role "admin"
 * (the service manager). The browser then signs in with the same password.
 * Steps are undone if a later one fails, so no half-created accounts remain.
 */
export async function POST(req: Request) {
  const blocked = guardRequest(req, { key: "signup", limit: 5, windowMs: 10 * 60_000 });
  if (blocked) return blocked;

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Accounts aren't configured on this server yet." }, { status: 503 });

  let b: Record<string, unknown>;
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const companyName = cleanText(b.companyName, 80);
  const fullName = cleanText(b.fullName, 80);
  const email = typeof b.email === "string" ? b.email.trim().toLowerCase() : "";
  const err =
    (companyName.length < 2 && "Enter your company name.") ||
    (fullName.length < 2 && "Enter your name.") ||
    validateEmail(email) ||
    validatePassword(b.password);
  if (err) return NextResponse.json({ error: err }, { status: 400 });

  const { data: created, error: userErr } = await admin.auth.admin.createUser({
    email,
    password: b.password as string,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (userErr || !created.user) {
    const taken = /already|registered|exists/i.test(userErr?.message ?? "");
    return NextResponse.json(
      { error: taken ? "An account with that email already exists. Sign in instead." : "Could not create the account." },
      { status: taken ? 409 : 400 },
    );
  }
  const userId = created.user.id;

  const { data: org, error: orgErr } = await admin.from("organizations").insert({ name: companyName }).select("id").single();
  if (orgErr || !org) {
    await admin.auth.admin.deleteUser(userId);
    console.error("[signup] organization insert failed:", orgErr?.message);
    return NextResponse.json({ error: "Could not create the company." }, { status: 500 });
  }

  const { error: techErr } = await admin
    .from("technicians")
    .insert({ id: userId, org_id: org.id, full_name: fullName, role: "admin", email, experience_years: 0 });
  if (techErr) {
    await admin.from("organizations").delete().eq("id", org.id);
    await admin.auth.admin.deleteUser(userId);
    console.error("[signup] technician insert failed:", techErr.message);
    return NextResponse.json({ error: "Could not create the manager profile." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
