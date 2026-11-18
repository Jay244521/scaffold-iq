import { test } from "node:test";
import assert from "node:assert/strict";
import { applyToolCall, clearEscalation, initialLiveState, type LiveSessionState } from "@/lib/ai/live-session-state";

function run(calls: [string, Record<string, unknown>][], start: LiveSessionState = initialLiveState) {
  let s = start;
  const responses = calls.map(([name, args]) => {
    const o = applyToolCall(s, name, args);
    s = o.state;
    return o.response;
  });
  return { s, responses };
}
const cap = { reading_type: "capacitance_uf", numeric_value: 44.6, unit: "µF", is_within_spec: true, target_spec_note: "45 ±6%" };
const isErr = (r: object) => "error" in r;

test("capacitor readings and step 4+ are locked until the disconnect is verified", () => {
  const { responses } = run([
    ["log_diagnostic_reading", cap],
    ["advance_diagnostic_step", { step_number: 4, instruction: "x", expected_target: "y", status: "in_progress" }],
    ["advance_diagnostic_step", { step_number: 3, instruction: "x", expected_target: "y", status: "passed" }],
  ]);
  assert.ok(responses.every(isErr));
});

test("voltage is allowed before the gate; capacitance after; gate re-locks when revoked", () => {
  const { s, responses } = run([
    ["log_diagnostic_reading", { reading_type: "voltage", numeric_value: 24.3, unit: "V", is_within_spec: true, target_spec_note: "24V" }],
    ["verify_safety_disconnect", { verified: true, verification_method: "verbal_confirmation", notes: "0V L1-L2" }],
    ["log_diagnostic_reading", cap],
    ["verify_safety_disconnect", { verified: false, verification_method: "visual_frame", notes: "power restored" }],
    ["log_diagnostic_reading", cap],
  ]);
  assert.deepEqual(responses.map(isErr), [false, false, false, false, true]);
  assert.equal(s.readings.length, 2);
});

test("invalid arguments are rejected with a reason", () => {
  const { responses } = run([
    ["register_equipment_plate", { manufacturer: "Carrier" }],
    ["log_diagnostic_reading", { ...cap, reading_type: "banana" }],
    ["register_equipment_plate", { manufacturer: "X", model_number: "Y", equipment_type: "rtu", tonnage: 150 }],
  ]);
  assert.ok(responses.every(isErr));
});

test("completion needs at least one reading and freezes the session", () => {
  const done = { confirmed_root_cause: "TXV", parts_replaced: ["strap", ""], dispatch_summary_report: "r" };
  const { s, responses } = run([
    ["complete_service_session", done],
    ["log_diagnostic_reading", { reading_type: "voltage", numeric_value: 24, unit: "V", is_within_spec: true, target_spec_note: "n" }],
    ["complete_service_session", done],
    ["log_diagnostic_reading", { reading_type: "voltage", numeric_value: 24, unit: "V", is_within_spec: true, target_spec_note: "n" }],
  ]);
  assert.deepEqual(responses.map(isErr), [true, false, false, true]);
  assert.deepEqual(s.completion?.parts_replaced, ["strap"]);
});

test("escalation opens once, blocks duplicates, and clears on manager review", () => {
  const esc = { reason: "Compressor 31.8A vs 21.2 RLA, cap 15% low", urgency: "stop_work" };
  const { s, responses } = run([
    ["escalate_to_manager", esc],
    ["escalate_to_manager", esc],
    ["escalate_to_manager", { reason: "short", urgency: "review" }],
  ]);
  assert.deepEqual(responses.map(isErr), [false, true, true]);
  assert.match(JSON.stringify(responses[0]), /stop work/i);
  assert.equal(s.escalation?.urgency, "stop_work");
  assert.equal(clearEscalation(s).escalation, null);
  assert.ok(!isErr(applyToolCall(clearEscalation(s), "escalate_to_manager", { reason: "New issue: static 0.92 in. w.c.", urgency: "review" }).response));
});
