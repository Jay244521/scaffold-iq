import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/supabase/server-auth";
import { isManagerRole } from "@/lib/supabase/config";
import { guardRequest } from "@/lib/server/request-guard";
import { cleanText, validatePassword } from "@/lib/auth/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ASSIGNABLE_ROLES = ["apprentice", "tech", "lead_tech"] as const;
/** ~100 years: Supabase Auth's way of saying "banned until reactivated". */
const BAN_FOREVER = "876000h";

/**
 * PATCH /api/team/:id
 * Body (one of):
 *   { action: "update", role?, truckLabel?, experienceYears? }
 *   { action: "reset_password", password }
 *   { action: "deactivate" } | { action: "reactivate" }
 *
 * Service managers manage technicians in their own company only. Lead techs can't
 * touch admins, nobody can deactivate or demote themselves, and deactivation bans
 * sign-in in Supabase Auth while keeping the technician's session history.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthContext();
  if (!auth?.tech) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (!isManagerRole(auth.tech.role)) return NextResponse.json({ error: "Only service managers can manage the team." }, { status: 403 });
  const blocked = guardRequest(req, { key: "team-manage", limit: 60, windowMs: 60 * 60_000, subject: auth.user.id });
  if (blocked) return blocked;

  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: "Invalid technician id." }, { status: 400 });
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Accounts aren't configured on this server yet." }, { status: 503 });

  const { data: target } = await admin.from("technicians").select("id, org_id, role, full_name").eq("id", id).maybeSingle();
  if (!target || target.org_id !== auth.tech.org_id) return NextResponse.json({ error: "Technician not found." }, { status: 404 });
  if (auth.tech.role === "lead_tech" && target.role === "admin") return NextResponse.json({ error: "Only an admin can change another admin." }, { status: 403 });
  const self = target.id === auth.user.id;

  let b: Record<string, unknown>;
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  switch (b.action) {
    case "update": {
      const patch: Record<string, unknown> = {};
      if (b.role !== undefined) {
        if (self) return NextResponse.json({ error: "You can't change your own role." }, { status: 400 });
        if (typeof b.role !== "string" || !(ASSIGNABLE_ROLES as readonly string[]).includes(b.role)) return NextResponse.json({ error: "Choose a valid role." }, { status: 400 });
        if (target.role === "admin") return NextResponse.json({ error: "Admins can't be demoted here." }, { status: 400 });
        patch.role = b.role;
      }
      if (b.truckLabel !== undefined) patch.truck_label = cleanText(b.truckLabel, 24) || null;
      if (b.experienceYears !== undefined) {
        const y = Number(b.experienceYears);
        if (!Number.isInteger(y) || y < 0 || y > 50) return NextResponse.json({ error: "Years of experience must be a whole number from 0 to 50." }, { status: 400 });
        patch.experience_years = y;
      }
      if (!Object.keys(patch).length) return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
      const { error } = await admin.from("technicians").update(patch).eq("id", id);
      if (error) return NextResponse.json({ error: "Could not save changes." }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    case "reset_password": {
      const err = validatePassword(b.password);
      if (err) return NextResponse.json({ error: err }, { status: 400 });
      const { error } = await admin.auth.admin.updateUserById(id, { password: b.password as string });
      if (error) return NextResponse.json({ error: "Could not reset the password." }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    case "deactivate":
    case "reactivate": {
      if (self) return NextResponse.json({ error: "You can't deactivate yourself." }, { status: 400 });
      const on = b.action === "deactivate";
      const { error: banErr } = await admin.auth.admin.updateUserById(id, { ban_duration: on ? BAN_FOREVER : "none" });
      if (banErr) return NextResponse.json({ error: "Could not update sign-in access." }, { status: 500 });
      const { error } = await admin.from("technicians").update({ deactivated_at: on ? new Date().toISOString() : null }).eq("id", id);
      if (error) return NextResponse.json({ error: "Could not update the technician." }, { status: 500 });
      if (on) {
        // Close anything they left running.
        await admin.from("service_sessions").update({ status: "ended", ended_at: new Date().toISOString() }).eq("tech_id", id).in("status", ["in_progress", "escalated"]);
      }
      return NextResponse.json({ ok: true });
    }

    default:
      return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }
}
