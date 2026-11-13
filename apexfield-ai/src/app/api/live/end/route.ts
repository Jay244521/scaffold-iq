import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/supabase/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/live/end   Body: { sessionId }
 *
 * The technician stopped the live session (End button, tab closed via sendBeacon).
 * Marks their own session "ended" unless it was already completed, so the fleet
 * dashboard stops showing it as active. Idempotent.
 */
export async function POST(req: Request) {
  const auth = await getAuthContext();
  if (!auth?.tech) return NextResponse.json({ ok: true, persisted: false });

  let sessionId: unknown;
  try {
    sessionId = ((await req.json()) as { sessionId?: unknown }).sessionId;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (typeof sessionId !== "string" || !UUID.test(sessionId)) return NextResponse.json({ error: "sessionId must be a UUID" }, { status: 400 });

  const { error } = await auth.supabase
    .from("service_sessions")
    .update({ status: "ended", ended_at: new Date().toISOString() })
    .eq("id", sessionId)
    .eq("tech_id", auth.user.id)
    .in("status", ["in_progress", "escalated"]);
  if (error) {
    console.error("[live/end]", error.message);
    return NextResponse.json({ error: "Could not end the session." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
