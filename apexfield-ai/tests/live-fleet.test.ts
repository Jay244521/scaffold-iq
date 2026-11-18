import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveStatus, mapLiveFleet, type DbSession } from "@/lib/live-fleet";
import { filterCounts } from "@/lib/fleet-sim";

const NOW = Date.parse("2026-11-13T18:00:00.000Z");
const at = (min: number) => new Date(NOW + min * 60_000).toISOString();
const session = (o: Partial<DbSession>): DbSession => ({
  id: "s", org_id: "o", tech_id: "t1", status: "in_progress", reported_symptom: "No cooling", current_step_index: 1,
  safety_disconnect_verified: false, confirmed_root_cause: null, parts_replaced: [], ai_summary_report: null,
  started_at: at(-20), completed_at: null, equipment_units: null, diagnostic_readings: [], diagnostic_steps: [], manager_whispers: [], ...o,
});
const techs = [
  { id: "t1", full_name: "Aaliyah Brooks", role: "apprentice", experience_years: 0, truck_label: "TRUCK-02" },
  { id: "t2", full_name: "Diego Ramirez", role: "tech", experience_years: 4, truck_label: null },
  { id: "t3", full_name: "Idle Ike", role: "tech", experience_years: 2, truck_label: "TRUCK-09" },
  { id: "m1", full_name: "Maria Lopez", role: "admin", experience_years: 12, truck_label: null },
];

test("status derivation", () => {
  assert.equal(deriveStatus({ status: "in_progress", safety_disconnect_verified: false, current_step_index: 3 }), "safety_hold");
  assert.equal(deriveStatus({ status: "in_progress", safety_disconnect_verified: true, current_step_index: 4 }), "coaching");
  assert.equal(deriveStatus({ status: "escalated", safety_disconnect_verified: true, current_step_index: 4 }), "escalated");
  assert.equal(deriveStatus({ status: "ended", safety_disconnect_verified: false, current_step_index: 2 }), "ended");
});

test("one card per tech, open sessions first; admins aren't idle field techs", () => {
  const { cards, idle } = mapLiveFleet(techs, [
    session({ id: "old", tech_id: "t1", status: "completed", started_at: at(-300), completed_at: at(-250), current_step_index: 5 }),
    session({
      id: "open", tech_id: "t1", current_step_index: 3,
      equipment_units: { manufacturer: "Trane", model_number: "4TWR6036H1000A", equipment_type: "heat_pump", refrigerant_type: "R-410A", tonnage: "3.00" },
      diagnostic_readings: [{ id: "r1", reading_type: "capacitance_uf", numeric_value: "34.1", unit: "uF", is_within_spec: false, recorded_at: at(-5) }],
      manager_whispers: [{ id: "w1", body: "Check the disconnect", created_at: at(-2), delivered_at: null, author_id: "m1" }],
    }),
    session({ id: "done", tech_id: "t2", status: "completed", current_step_index: 5, safety_disconnect_verified: true, completed_at: at(-1), confirmed_root_cause: "Failed fan motor" }),
  ], NOW);
  assert.deepEqual(cards.map((c) => c.id).sort(), ["done", "open"]);
  assert.deepEqual(idle.map((t) => t.id), ["t3"]);
  const a = cards.find((c) => c.id === "open")!;
  assert.equal(a.status, "safety_hold");
  assert.equal(a.equipment.size, "3T");
  assert.equal(a.readings[0].status, "out");
  assert.equal(a.readings[0].unit, "µF");
  assert.ok(a.transcript.some((l) => l.role === "manager" && /waiting/.test(l.text)));
  assert.deepEqual(filterCounts(cards), { all: 2, attention: 1, apprentices: 1, in_progress: 1, completed: 1 });
});

test("escalated sessions carry the AI's reason; ended and stale sessions read as ended", () => {
  const { cards } = mapLiveFleet(techs, [
    session({ id: "esc", tech_id: "t1", status: "escalated", current_step_index: 4, safety_disconnect_verified: true, escalation_reason: "STOP WORK: 31.8A vs 21.2 RLA", escalated_at: at(-3) }),
    session({ id: "end", tech_id: "t2", status: "ended", current_step_index: 2, ended_at: at(-10) }),
    session({ id: "stale", tech_id: "t3", status: "in_progress", started_at: at(-200), current_step_index: 2 }),
  ], NOW);
  const by = Object.fromEntries(cards.map((c) => [c.id, c]));
  assert.equal(by.esc.status, "escalated");
  assert.match(by.esc.statusReason!, /31\.8A/);
  assert.ok(by.esc.transcript.some((l) => /AI escalated/.test(l.text)));
  assert.equal(by.end.status, "ended");
  assert.equal(by.end.elapsedSec, 10 * 60, "clock stops when the session ended");
  assert.equal(by.stale.status, "ended");
  assert.match(by.stale.statusReason!, /No activity/);
  assert.deepEqual(filterCounts(cards), { all: 3, attention: 1, apprentices: 1, in_progress: 1, completed: 0 });
});
