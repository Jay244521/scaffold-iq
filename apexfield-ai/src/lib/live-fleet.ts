/**
 * Maps real coaching rows from Supabase (technicians, service_sessions + equipment,
 * readings, steps, whispers) onto the dashboard's Technician view model, so the live
 * fleet reuses the same cards, filters and inspector as the demo board.
 * Pure: `now` is passed in so timers tick without refetching.
 */
import type { DiagnosticStep, EquipmentKind, Reading, StepStatus, TechStatus, Technician, TranscriptLine } from "./mock-fleet-data";
import { STEP_SUMMARY } from "./fleet-sim";
import { SAFETY_STEP } from "./diagnostic-sequence";

export type DbTechnician = {
  id: string;
  full_name: string;
  role: string;
  experience_years: number | null;
  truck_label: string | null;
  email?: string | null;
};

export type DbSession = {
  id: string;
  org_id: string;
  tech_id: string | null;
  status: string;
  reported_symptom: string;
  current_step_index: number;
  safety_disconnect_verified: boolean;
  confirmed_root_cause: string | null;
  parts_replaced: unknown;
  ai_summary_report: string | null;
  started_at: string;
  completed_at: string | null;
  equipment_units: {
    manufacturer: string;
    model_number: string;
    equipment_type: string;
    refrigerant_type: string | null;
    tonnage: number | string | null;
  } | null;
  diagnostic_readings: { id: string; reading_type: string; numeric_value: number | string; unit: string; is_within_spec: boolean | null; recorded_at: string }[];
  diagnostic_steps: { id: string; step_number: number; instruction: string; expected_target: string | null; tech_observation: string | null; status: string; created_at: string }[];
  manager_whispers?: { id: string; body: string; created_at: string; delivered_at: string | null; author_id: string | null }[];
};

const READING_META: Record<string, { label: string; short: string }> = {
  suction_psi: { label: "Suction", short: "SUC" },
  liquid_psi: { label: "Liquid", short: "LIQ" },
  superheat: { label: "Superheat", short: "SH" },
  subcooling: { label: "Subcooling", short: "SC" },
  amp_draw: { label: "Amp Draw", short: "AMP" },
  voltage: { label: "Voltage", short: "V" },
  static_pressure: { label: "Static Pressure", short: "TESP" },
  capacitance_uf: { label: "Capacitance", short: "CAP" },
};

const UNIT_DISPLAY: Record<string, string> = { psi: "PSI", degF: "°F", amps: "A", volts: "V", inWC: "in. w.c.", uF: "µF" };

const KIND: Record<string, EquipmentKind> = { split_ac: "split_ac", heat_pump: "heat_pump", rtu: "rtu", gas_furnace: "furnace" };

const secsBetween = (from: string, to: number) => Math.max(0, Math.floor((to - new Date(from).getTime()) / 1000));

export function deriveStatus(s: Pick<DbSession, "status" | "safety_disconnect_verified" | "current_step_index">): TechStatus {
  if (s.status === "completed") return "completed";
  if (s.status === "escalated") return "escalated";
  // Sitting at (or past) the high-voltage gate without verification = safety hold.
  if (!s.safety_disconnect_verified && s.current_step_index >= SAFETY_STEP) return "safety_hold";
  return "coaching";
}

function mapSteps(s: DbSession, status: TechStatus): DiagnosticStep[] {
  const current = Math.min(Math.max(s.current_step_index || 1, 1), 5);
  const latest = new Map<number, DbSession["diagnostic_steps"][number]>();
  for (const st of [...s.diagnostic_steps].sort((a, b) => a.created_at.localeCompare(b.created_at))) latest.set(st.step_number, st);
  return [1, 2, 3, 4, 5].map((n) => {
    const row = latest.get(n);
    let st: StepStatus;
    if (row?.status === "passed" || row?.status === "failed") st = row.status;
    else if (status === "completed") st = "passed";
    else if (n < current) st = n === SAFETY_STEP && !s.safety_disconnect_verified ? "hold" : "passed";
    else if (n === current) st = status === "safety_hold" ? "hold" : status === "escalated" ? "failed" : "active";
    else st = "upcoming";
    return { n, status: st, finding: row ? (row.tech_observation ?? row.instruction) : undefined };
  });
}

function mapReadings(s: DbSession): Reading[] {
  return [...s.diagnostic_readings]
    .sort((a, b) => a.recorded_at.localeCompare(b.recorded_at))
    .map((r) => {
      const meta = READING_META[r.reading_type] ?? { label: r.reading_type, short: r.reading_type.slice(0, 4).toUpperCase() };
      return {
        id: r.id,
        label: meta.label,
        short: meta.short,
        value: Number(r.numeric_value),
        unit: UNIT_DISPLAY[r.unit] ?? r.unit,
        spec: r.is_within_spec === null ? "Not judged" : r.is_within_spec ? "Within OEM spec" : "Outside OEM spec",
        status: r.is_within_spec === false ? "out" : "ok",
        atSec: secsBetween(s.started_at, new Date(r.recorded_at).getTime()),
      };
    });
}

/** Session event log for the inspector (the voice transcript itself is never stored). */
function mapEventLog(s: DbSession, readings: Reading[]): TranscriptLine[] {
  const at = (iso: string) => secsBetween(s.started_at, new Date(iso).getTime());
  const lines: (TranscriptLine & { sort: string })[] = [];
  lines.push({ id: `start-${s.id}`, role: "system", text: `Session started · reported symptom: ${s.reported_symptom}`, atSec: 0, sort: s.started_at });
  for (const st of s.diagnostic_steps) {
    const status = st.status === "pending" ? "in progress" : st.status;
    lines.push({
      id: st.id,
      role: "ai",
      text: `Step ${st.step_number} · ${st.instruction}${st.expected_target ? ` (target: ${st.expected_target})` : ""} — ${status}${st.tech_observation ? `. ${st.tech_observation}` : ""}`,
      atSec: at(st.created_at),
      sort: st.created_at,
    });
  }
  for (const r of s.diagnostic_readings) {
    const m = readings.find((x) => x.id === r.id)!;
    lines.push({
      id: r.id,
      role: "tech",
      text: `Logged ${m.label}: ${m.value}${m.unit.startsWith("°") ? "" : " "}${m.unit} (${r.is_within_spec === false ? "OUT OF SPEC" : r.is_within_spec ? "in spec" : "not judged"})`,
      atSec: at(r.recorded_at),
      sort: r.recorded_at,
    });
  }
  for (const w of s.manager_whispers ?? []) {
    lines.push({ id: w.id, role: "manager", text: `${w.body}${w.delivered_at ? " ✓ delivered to headset" : " · waiting for the tech's session"}`, atSec: at(w.created_at), sort: w.created_at });
  }
  if (s.completed_at) {
    lines.push({
      id: `done-${s.id}`,
      role: "system",
      text: `Completed · root cause: ${s.confirmed_root_cause ?? "—"}${s.ai_summary_report ? `. ${s.ai_summary_report}` : ""}`,
      atSec: at(s.completed_at),
      sort: s.completed_at,
    });
  }
  return lines.sort((a, b) => a.sort.localeCompare(b.sort)).map(({ sort: _sort, ...l }) => l);
}

export function mapSessionToTechnician(tech: DbTechnician, s: DbSession, now: number): Technician {
  const status = deriveStatus(s);
  const e = s.equipment_units;
  const readings = mapReadings(s);
  const current = Math.min(Math.max(s.current_step_index || 1, 1), 5);
  const currentRow = [...s.diagnostic_steps].filter((x) => x.step_number === current).sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  const months = Math.max(0, (tech.experience_years ?? 0) * 12);
  return {
    id: s.id,
    name: tech.full_name,
    role: tech.role === "apprentice" || months < 12 ? "Apprentice" : "Tech",
    experienceMonths: months,
    truck: tech.truck_label || "NO TRUCK",
    city: "Live session",
    customer: s.reported_symptom,
    jobType: e?.equipment_type === "rtu" ? "Light Commercial" : "Residential",
    status,
    statusReason:
      status === "safety_hold"
        ? "Waiting on high-voltage disconnect verification"
        : status === "escalated"
          ? "Escalated for review"
          : status === "completed"
            ? (s.confirmed_root_cause ?? "Completed")
            : undefined,
    equipment: e
      ? {
          brand: e.manufacturer,
          model: e.model_number,
          kind: KIND[e.equipment_type] ?? "split_ac",
          refrigerant: e.refrigerant_type ?? "—",
          size: e.tonnage !== null && e.tonnage !== undefined ? `${Number(e.tonnage)}T` : "—",
        }
      : { brand: "Unregistered", model: "data plate not scanned yet", kind: "split_ac", refrigerant: "—", size: "—" },
    elapsedSec: secsBetween(s.started_at, s.completed_at ? new Date(s.completed_at).getTime() : now),
    currentStep: current,
    stepSummary: status === "completed" ? "Job complete · dispatch report saved" : (currentRow?.instruction ?? STEP_SUMMARY[current]),
    steps: mapSteps(s, status),
    readings,
    transcript: mapEventLog(s, readings),
    safetyVerified: s.safety_disconnect_verified,
    backupDispatched: false,
    ticksOnStep: 0,
    holdAutoResolves: false,
    live: { sessionId: s.id, orgId: s.org_id, startedAt: s.started_at },
  };
}

/** One card per technician: their in-progress session, else their latest session today. */
export function mapLiveFleet(techs: DbTechnician[], sessions: DbSession[], now: number) {
  const byTech = new Map<string, DbSession>();
  for (const s of [...sessions].sort((a, b) => b.started_at.localeCompare(a.started_at))) {
    if (!s.tech_id) continue;
    const prev = byTech.get(s.tech_id);
    if (!prev || (prev.status !== "in_progress" && s.status === "in_progress")) byTech.set(s.tech_id, s);
  }
  const cards: Technician[] = [];
  const idle: DbTechnician[] = [];
  for (const t of techs) {
    const s = byTech.get(t.id);
    if (s) cards.push(mapSessionToTechnician(t, s, now));
    else if (t.role !== "admin") idle.push(t); // office admins aren't field techs unless they run a session
  }
  return { cards, idle };
}
