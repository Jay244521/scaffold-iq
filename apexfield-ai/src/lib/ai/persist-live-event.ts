/**
 * Write one accepted live-session tool call into the coaching schema.
 * See src/app/api/live/events/route.ts for the table mapping.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { HvacToolCall } from "./hvac-tools";
import { escapeLike, normalizeEquipmentType, normalizeUnit } from "./persist-normalize";

const STEP_STATUS = { passed: "passed", failed: "failed", in_progress: "pending" } as const;

/* ------------------------------ writes ------------------------------ */

async function must<T>(p: PromiseLike<{ data: T; error: { message: string } | null }>, what: string): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(`${what}: ${error.message}`);
  return data;
}

export async function persistLiveEvent(db: SupabaseClient, sessionId: string, call: HvacToolCall): Promise<Record<string, unknown>> {
  const now = new Date().toISOString();

  switch (call.name) {
    case "register_equipment_plate": {
      const a = call.args;
      const model = a.model_number.toUpperCase();
      const serial = a.serial_number?.toUpperCase() ?? null;
      // equipment_units has no unique key: reuse an existing org-less unit with the same identity.
      let q = db.from("equipment_units").select("id").is("org_id", null).ilike("manufacturer", escapeLike(a.manufacturer)).eq("model_number", model);
      q = serial ? q.eq("serial_number", serial) : q.is("serial_number", null);
      const existing = await must(q.limit(1).maybeSingle(), "equipment lookup");
      const equipmentId =
        (existing as { id: string } | null)?.id ??
        (
          (await must(
            db
              .from("equipment_units")
              .insert({
                manufacturer: a.manufacturer,
                model_number: model,
                serial_number: serial,
                equipment_type: normalizeEquipmentType(a.equipment_type),
                refrigerant_type: a.refrigerant_type ?? null,
                tonnage: a.tonnage ?? null,
              })
              .select("id")
              .single(),
            "equipment insert",
          )) as { id: string }
        ).id;
      await must(db.from("service_sessions").update({ equipment_id: equipmentId }).eq("id", sessionId), "link equipment");
      return { equipmentUnitId: equipmentId };
    }

    case "verify_safety_disconnect": {
      const a = call.args;
      await must(
        db.from("service_sessions").update({ safety_disconnect_verified: a.verified }).eq("id", sessionId),
        "safety update",
      );
      // The sessions table has no column for how it was verified; keep that audit trail on the step log.
      await must(
        db.from("diagnostic_steps").insert({
          session_id: sessionId,
          step_number: 3,
          instruction: "High-voltage disconnect verification",
          expected_target: "Disconnect pulled, 0V AC across L1/L2",
          tech_observation: `${a.verification_method === "visual_frame" ? "Seen on camera" : "Verbal confirmation"}: ${a.notes}`,
          status: a.verified ? "passed" : "failed",
        }),
        "safety step insert",
      );
      return {};
    }

    case "log_diagnostic_reading": {
      const a = call.args;
      await must(
        db.from("diagnostic_readings").insert({
          session_id: sessionId,
          reading_type: a.reading_type,
          numeric_value: a.numeric_value,
          unit: normalizeUnit(a.unit),
          is_within_spec: a.is_within_spec,
        }),
        "reading insert",
      );
      return {};
    }

    case "advance_diagnostic_step": {
      const a = call.args;
      await must(
        db.from("diagnostic_steps").insert({
          session_id: sessionId,
          step_number: a.step_number,
          instruction: a.instruction,
          expected_target: a.expected_target,
          status: STEP_STATUS[a.status],
        }),
        "step insert",
      );
      const current = a.status === "passed" ? Math.min(a.step_number + 1, 5) : a.step_number;
      await must(db.from("service_sessions").update({ current_step_index: current }).eq("id", sessionId), "step index update");
      return {};
    }

    case "complete_service_session": {
      const a = call.args;
      await must(
        db
          .from("service_sessions")
          .update({
            status: "completed",
            confirmed_root_cause: a.confirmed_root_cause,
            parts_replaced: a.parts_replaced,
            ai_summary_report: a.dispatch_summary_report,
            completed_at: now,
          })
          .eq("id", sessionId),
        "complete session",
      );
      return {};
    }
  }
}
