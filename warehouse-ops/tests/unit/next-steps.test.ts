import { test } from "node:test";
import assert from "node:assert/strict";
import { suggestNextSteps, type StepInput } from "../../src/lib/next-steps";

const base: StepInput = {
  type: "shortage", status: "open", supplierName: "Acme", poNumber: "PO-1", shipmentRef: null,
  expectedQty: 100, receivedQty: 92, assignedTo: "u1", photoCount: 1, bolCount: 1, commentCount: 1, ageDays: 1,
};
const keys = (i: Partial<StepInput>) => suggestNextSteps({ ...base, ...i }).map((s) => s.key);

test("resolved incidents get no suggestions", () => {
  assert.deepEqual(suggestNextSteps({ ...base, status: "resolved" }), []);
  assert.deepEqual(suggestNextSteps({ ...base, status: "closed" }), []);
});

test("shortage suggests a recount and a credit for the exact units", () => {
  const steps = suggestNextSteps(base);
  assert.ok(steps.some((s) => s.key === "recount"));
  assert.ok(steps.find((s) => s.key === "claim")!.text.includes("8 units from Acme"));
});

test("missing evidence and ownership are flagged first", () => {
  const steps = suggestNextSteps({ ...base, type: "damaged", bolCount: 0, photoCount: 0, assignedTo: null, supplierName: null, poNumber: null });
  assert.equal(steps[0].priority, "high");
  for (const k of ["bol", "photos", "supplier", "refs", "assign"]) assert.ok(steps.some((s) => s.key === k), k);
});

test("type-specific playbooks", () => {
  assert.ok(keys({ type: "overage", expectedQty: 10, receivedQty: 12 }).includes("quarantine-over"));
  assert.ok(suggestNextSteps({ ...base, type: "overage", expectedQty: 10, receivedQty: 12 }).find((s) => s.key === "quarantine-over")!.text.includes("extra 2 units"));
  assert.ok(keys({ type: "wrong_item" }).includes("rma"));
  assert.ok(keys({ type: "damaged" }).includes("carrier-or-supplier"));
  assert.ok(keys({ type: "other" }).includes("define"));
});

test("old incidents are escalated; quiet ones prompt an update", () => {
  assert.ok(keys({ ageDays: 9 }).includes("escalate"));
  assert.ok(keys({ ageDays: 3, commentCount: 0 }).includes("update"));
  assert.ok(!keys({ ageDays: 1 }).includes("escalate"));
});
