import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/supabase/server-auth";
import { isManagerRole } from "@/lib/supabase/config";
import { guardRequest } from "@/lib/server/request-guard";
import { cleanText, validateEmail, validatePassword } from "@/lib/auth/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ASSIGNABLE_ROLES = ["apprentice", "tech", "lead_tech"] as const;

/**
 * POST /api/team
 * Body: { fullName, email, password, role: apprentice|tech|lead_tech, experienceYears?, truckLabel? }
 *
 * A service manager (admin / lead_tech) adds a technician to their own company.
 * The account is created confirmed with the temporary password the manager sets.
 */
export async function POST(req: Request) {
  const auth = await getAuthContext();
  if (!auth?.tech) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (!isManagerRole(auth.tech.role)) return NextResponse.json({ error: "Only service managers can add technicians." }, { status: 403 });

  const blocked = guardRequest(req, { key: "team-add", limit: 30, windowMs: 60 * 60_000, subject: auth.user.id });
  if (blocked) return blocked;

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Accounts aren't configured on this server yet." }, { status: 503 });

  let b: Record<string, unknown>;
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const fullName = cleanText(b.fullName, 80);
  const email = typeof b.email === "string" ? b.email.trim().toLowerCase() : "";
  const role = typeof b.role === "string" && (ASSIGNABLE_ROLES as readonly string[]).includes(b.role) ? b.role : null;
  const years = b.experienceYears === undefined || b.experienceYears === "" ? 0 : Number(b.experienceYears);
  const truckLabel = cleanText(b.truckLabel, 24) || null;
  const err =
    (fullName.length < 2 && "Enter the technician's name.") ||
    validateEmail(email) ||
    validatePassword(b.password) ||
    (!role && "Choose a role.") ||
    ((!Number.isInteger(years) || years < 0 || years > 50) && "Years of experience must be a whole number from 0 to 50.");
  if (err) return NextResponse.json({ error: err }, { status: 400 });

  const { data: created, error: userErr } = await admin.auth.admin.createUser({
    email,
    password: b.password as string,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (userErr || !created.user) {
    const taken = /already|registered|exists/i.test(userErr?.message ?? "");
    return NextResponse.json({ error: taken ? "That email already has an account." : "Could not create the account." }, { status: taken ? 409 : 400 });
  }

  const member = {
    id: created.user.id,
    org_id: auth.tech.org_id,
    full_name: fullName,
    role,
    email,
    experience_years: years,
    truck_label: truckLabel,
  };
  const { error: techErr } = await admin.from("technicians").insert(member);
  if (techErr) {
    await admin.auth.admin.deleteUser(created.user.id);
    console.error("[team] technician insert failed:", techErr.message);
    return NextResponse.json({ error: "Could not add the technician." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, member });
}
