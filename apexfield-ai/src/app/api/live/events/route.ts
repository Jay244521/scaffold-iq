import { NextResponse } from "next/server";
import { parseToolCall } from "@/lib/ai/hvac-tools";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { guardRequest } from "@/lib/server/request-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/live/events
 * Body: { sessionId: string, name: HvacToolName, args: object }
 *
 * Persists one accepted HVAC tool call to Supabase. Arguments are re-validated
 * here with the same schema the browser uses. No-ops when Supabase is not set up.
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

  const sessionId = body.sessionId;
  const { call } = parsed;
  const now = new Date().toISOString();

  const fail = (where: string, message: string) => {
    console.error(`[live/events] ${where}:`, message);
    return NextResponse.json({ error: "Could not save this event." }, { status: 500 });
  };

  switch (call.name) {
    case "register_equipment_plate": {
      const a = call.args;
      const { data, error } = await db
        .from("equipment_units")
        .upsert(
          {
            manufacturer: a.manufacturer,
            model_number: a.model_number.toUpperCase(),
            serial_number: a.serial_number?.toUpperCase() ?? null,
            equipment_type: a.equipment_type,
            refrigerant_type: a.refrigerant_type ?? null,
            tonnage: a.tonnage ?? null,
            updated_at: now,
          },
          { onConflict: "manufacturer,model_number,serial_number" },
        )
        .select("id")
        .single();
      if (error) return fail("equipment upsert", error.message);
      const link = await db.from("service_sessions").update({ equipment_unit_id: data.id }).eq("id", sessionId);
      if (link.error) return fail("link equipment", link.error.message);
      return NextResponse.json({ ok: true, persisted: true, equipmentUnitId: data.id });
    }

    case "verify_safety_disconnect": {
      const a = call.args;
      const { error } = await db
        .from("service_sessions")
        .update({
          safety_disconnect_verified: a.verified,
          safety_verification_method: a.verified ? a.verification_method : null,
          safety_verification_notes: a.notes,
          safety_verified_at: a.verified ? now : null,
        })
        .eq("id", sessionId);
      if (error) return fail("safety update", error.message);
      return NextResponse.json({ ok: true, persisted: true });
    }

    case "log_diagnostic_reading": {
      const a = call.args;
      const { error } = await db.from("diagnostic_readings").insert({ session_id: sessionId, ...a });
      if (error) return fail("reading insert", error.message);
      return NextResponse.json({ ok: true, persisted: true });
    }

    case "advance_diagnostic_step": {
      const { error } = await db.from("diagnostic_steps").insert({ session_id: sessionId, ...call.args });
      if (error) return fail("step insert", error.message);
      return NextResponse.json({ ok: true, persisted: true });
    }

    case "complete_service_session": {
      const { error } = await db
        .from("service_sessions")
        .update({ ...call.args, status: "completed", completed_at: now })
        .eq("id", sessionId);
      if (error) return fail("complete session", error.message);
      return NextResponse.json({ ok: true, persisted: true });
    }
  }
}
