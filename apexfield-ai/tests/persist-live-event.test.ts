import { test } from "node:test";
import assert from "node:assert/strict";
import { persistLiveEvent } from "@/lib/ai/persist-live-event";
import { parseToolCall } from "@/lib/ai/hvac-tools";
import { normalizeEquipmentType, normalizeUnit } from "@/lib/ai/persist-normalize";

type Op = { table: string; op: string; values?: Record<string, unknown>; filters: string[] };

/** Records every query the persistence layer builds, like a PostgREST client would send. */
function recorder(existingEquipmentId: string | null) {
  const ops: Op[] = [];
  const db = {
    from(table: string) {
      const rec: Op = { table, op: "select", filters: [] };
      const b: Record<string, unknown> = {};
      const chain = () => b;
      Object.assign(b, {
        select: chain, limit: chain, maybeSingle: chain, single: chain,
        insert: (v: Record<string, unknown>) => ((rec.op = "insert"), (rec.values = v), b),
        update: (v: Record<string, unknown>) => ((rec.op = "update"), (rec.values = v), b),
        eq: (c: string, v: unknown) => (rec.filters.push(`${c}=${v}`), b),
        is: (c: string, v: unknown) => (rec.filters.push(`${c} is ${v}`), b),
        ilike: (c: string, v: unknown) => (rec.filters.push(`${c} ilike ${v}`), b),
        then: (resolve: (x: unknown) => void) => {
          ops.push(rec);
          resolve({ data: rec.op === "select" ? (existingEquipmentId ? { id: existingEquipmentId } : null) : rec.op === "insert" ? { id: "new-eq" } : null, error: null });
        },
      });
      return b;
    },
  };
  return { db: db as never, ops };
}
const call = (name: string, args: Record<string, unknown>) => {
  const p = parseToolCall(name, args);
  assert.ok(p.ok, name);
  return p.call;
};

test("equipment is looked up and inserted within the tech's org", async () => {
  const { db, ops } = recorder(null);
  await persistLiveEvent(db, "S1", call("register_equipment_plate", { manufacturer: "Carrier", model_number: "24acc636a003", equipment_type: "split AC condenser", tonnage: 3 }), { orgId: "ORG" });
  assert.ok(ops[0].filters.includes("org_id=ORG"));
  assert.equal(ops[1].values?.org_id, "ORG");
  assert.equal(ops[1].values?.model_number, "24ACC636A003");
  assert.equal(ops[1].values?.equipment_type, "split_ac");
  assert.deepEqual(ops[2].values, { equipment_id: "new-eq" });
});

test("escalation updates the session status and reason", async () => {
  const { db, ops } = recorder(null);
  await persistLiveEvent(db, "S1", call("escalate_to_manager", { reason: "Static 0.92 in. w.c. with clean filters", urgency: "stop_work" }), { orgId: "ORG" });
  assert.equal(ops[0].table, "service_sessions");
  assert.equal(ops[0].values?.status, "escalated");
  assert.match(String(ops[0].values?.escalation_reason), /^STOP WORK: Static/);
});

test("units and equipment types normalize to the schema vocabulary", () => {
  assert.deepEqual(["PSIG", "°F", "A", "V", "in. w.c.", "µF"].map(normalizeUnit), ["psi", "degF", "amps", "volts", "inWC", "uF"]);
  assert.deepEqual(["Packaged rooftop unit", "gas furnace", "Heat Pump"].map(normalizeEquipmentType), ["rtu", "gas_furnace", "heat_pump"]);
});
