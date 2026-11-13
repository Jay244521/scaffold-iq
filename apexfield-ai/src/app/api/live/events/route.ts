import { NextResponse } from "next/server";
import { parseToolCall } from "@/lib/ai/hvac-tools";
import { persistLiveEvent } from "@/lib/ai/persist-live-event";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { guardRequest } from "@/lib/server/request-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/live/events
 * Body: { sessionId: string, name: HvacToolName, args: object }
 *
 * Persists one accepted HVAC tool call into the project's coaching schema
 * (supabase/migrations/20261112214003_hvac_coaching_schema.sql):
 *   register_equipment_plate  → equipment_units (reused if already registered) + service_sessions.equipment_id
 *   verify_safety_disconnect  → service_sessions.safety_disconnect_verified + a step-3 diagnostic_steps record
 *   log_diagnostic_reading    → diagnostic_readings
 *   advance_diagnostic_step   → diagnostic_steps + service_sessions.current_step_index
 *   complete_service_session  → service_sessions (root cause, parts, report, completed)
 *
 * Arguments are re-validated with the same schema the browser uses. Writes use the
 * service role; no-ops when Supabase is not configured.
 */
export async function POST(req: Request) {
  const blocked = guardRequest(req, { key: "live-events", limit: 240, windowMs: 60_000 });
  if (blocked) return blocked;

  let body: { sessionId?: unknown; name?: unknown; args?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (typeof body.sessionId !== "string" || !UUID.test(body.sessionId)) {
    return NextResponse.json({ error: "sessionId must be a UUID" }, { status: 400 });
  }
  const parsed = parseToolCall(body.name, body.args);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ ok: true, persisted: false });

  try {
    const extra = await persistLiveEvent(db, body.sessionId, parsed.call);
    return NextResponse.json({ ok: true, persisted: true, ...extra });
  } catch (e) {
    console.error(`[live/events] ${parsed.call.name}:`, e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Could not save this event." }, { status: 500 });
  }
}
