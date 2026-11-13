import { test } from "node:test";
import assert from "node:assert/strict";
import { buildLiveConnectConfig, parseLookupArgs, parseToolCall } from "@/lib/ai/hvac-tools";

test("session config exposes all seven tools and the key prompt rules", () => {
  const cfg = buildLiveConnectConfig() as { tools: { functionDeclarations: { name: string }[] }[]; systemInstruction: string };
  const names = cfg.tools[0].functionDeclarations.map((f) => f.name).sort();
  assert.deepEqual(names, [
    "advance_diagnostic_step",
    "complete_service_session",
    "escalate_to_manager",
    "log_diagnostic_reading",
    "lookup_oem_spec",
    "register_equipment_plate",
    "verify_safety_disconnect",
  ]);
  for (const rule of ["lookup_oem_spec", "escalate_to_manager", "[SERVICE MANAGER]", "Never tell the technician to bypass"]) {
    assert.ok(cfg.systemInstruction.includes(rule), rule);
  }
});

test("readings round to 2 dp and coerce numeric strings", () => {
  const r = parseToolCall("log_diagnostic_reading", { reading_type: "superheat", numeric_value: "9.876", unit: "°F", is_within_spec: true, target_spec_note: "8-12" });
  assert.ok(r.ok && r.call.name === "log_diagnostic_reading" && r.call.args.numeric_value === 9.88);
});

test("lookup args are trimmed and chunk_type is validated", () => {
  assert.deepEqual(parseLookupArgs({ query: "  target  subcooling " }), { ok: true, args: { query: "target subcooling" } });
  assert.equal(parseLookupArgs({ query: "x" }).ok, false);
  assert.equal(parseLookupArgs({ query: "e4 code", chunk_type: "general" }).ok, false);
});
