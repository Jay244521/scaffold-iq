/** CSV export of service sessions for records, invoicing and warranty claims. */
import type { DbSession, DbTechnician } from "./live-fleet";

const COLUMNS = [
  "started_at", "technician", "truck", "status", "manufacturer", "model_number", "equipment_type", "reported_symptom",
  "confirmed_root_cause", "parts_replaced", "duration_min", "readings", "out_of_spec_readings", "safety_disconnect_verified",
  "escalation_reason", "consent_acknowledged_at", "ai_summary_report", "session_id",
] as const;

/** RFC 4180 quoting, plus a leading ' on cells that spreadsheets would execute as formulas. */
export function csvCell(v: unknown): string {
  let s = v === null || v === undefined ? "" : Array.isArray(v) ? v.join("; ") : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function sessionsToCsv(sessions: (DbSession & { consent_acknowledged_at?: string | null })[], techs: DbTechnician[]): string {
  const byId = new Map(techs.map((t) => [t.id, t]));
  const rows = sessions.map((s) => {
    const t = s.tech_id ? byId.get(s.tech_id) : undefined;
    const end = s.completed_at ?? s.ended_at ?? null;
    const parts = Array.isArray(s.parts_replaced) ? (s.parts_replaced as unknown[]).map(String) : [];
    return [
      s.started_at,
      t?.full_name ?? "",
      t?.truck_label ?? "",
      s.status,
      s.equipment_units?.manufacturer ?? "",
      s.equipment_units?.model_number ?? "",
      s.equipment_units?.equipment_type ?? "",
      s.reported_symptom,
      s.confirmed_root_cause ?? "",
      parts,
      end ? Math.round((Date.parse(end) - Date.parse(s.started_at)) / 60_000) : "",
      s.diagnostic_readings.length,
      s.diagnostic_readings.filter((r) => r.is_within_spec === false).length,
      s.safety_disconnect_verified ? "yes" : "no",
      s.escalation_reason ?? "",
      s.consent_acknowledged_at ?? "",
      s.ai_summary_report ?? "",
      s.id,
    ].map(csvCell).join(",");
  });
  return [COLUMNS.join(","), ...rows].join("\r\n");
}
