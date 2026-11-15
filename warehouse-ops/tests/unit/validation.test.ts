import { test } from "node:test";
import assert from "node:assert/strict";
import { incidentFilterSchema, incidentSchema, inviteSchema, sanitizeSearch, signupSchema, statusSchema } from "../../src/lib/validation";
import { safeNext } from "../../src/lib/safe-next";

const FAC = "6f1c1c4e-3f0a-4c55-9a51-6d3a3c1d2b10";
const base = { facilityId: FAC, type: "damaged", description: "Crushed pallet", occurredAt: new Date().toISOString() };

test("incident: accepts a minimal damaged report", () => {
  assert.equal(incidentSchema.safeParse(base).success, true);
});

test("incident: requires type, facility and description", () => {
  const r = incidentSchema.safeParse({ occurredAt: base.occurredAt });
  assert.equal(r.success, false);
  const paths = r.error!.issues.map((i) => i.path[0]);
  for (const p of ["facilityId", "type", "description"]) assert.ok(paths.includes(p), `missing error for ${p}`);
});

test("incident: shortage needs both quantities and received < expected", () => {
  assert.equal(incidentSchema.safeParse({ ...base, type: "shortage" }).success, false);
  assert.equal(incidentSchema.safeParse({ ...base, type: "shortage", expectedQty: "100", receivedQty: "100" }).success, false);
  const ok = incidentSchema.safeParse({ ...base, type: "shortage", expectedQty: "1,000", receivedQty: "992" });
  assert.equal(ok.success, true);
  assert.equal(ok.data!.expectedQty, 1000);
});

test("incident: overage requires received > expected", () => {
  assert.equal(incidentSchema.safeParse({ ...base, type: "overage", expectedQty: "10", receivedQty: "8" }).success, false);
  assert.equal(incidentSchema.safeParse({ ...base, type: "overage", expectedQty: "10", receivedQty: "12" }).success, true);
});

test("incident: rejects negative / non-numeric quantities, future dates and bad facility ids", () => {
  assert.equal(incidentSchema.safeParse({ ...base, expectedQty: "-1" }).success, false);
  assert.equal(incidentSchema.safeParse({ ...base, expectedQty: "abc" }).success, false);
  assert.equal(incidentSchema.safeParse({ ...base, occurredAt: new Date(Date.now() + 3_600_000).toISOString() }).success, false);
  assert.equal(incidentSchema.safeParse({ ...base, facilityId: "1 OR 1=1" }).success, false);
  assert.equal(incidentSchema.safeParse({ ...base, description: "x".repeat(5001) }).success, false);
});

test("status: resolving or closing requires notes", () => {
  assert.equal(statusSchema.safeParse({ status: "resolved" }).success, false);
  assert.equal(statusSchema.safeParse({ status: "closed" }).success, false);
  assert.equal(statusSchema.safeParse({ status: "resolved", resolutionNotes: "Credit memo issued" }).success, true);
  assert.equal(statusSchema.safeParse({ status: "in_progress" }).success, true);
  assert.equal(statusSchema.safeParse({ status: "deleted" }).success, false);
});

test("invite: cannot invite an owner; email is normalized", () => {
  assert.equal(inviteSchema.safeParse({ email: "a@b.co", role: "owner" }).success, false);
  const r = inviteSchema.safeParse({ email: "Ann@Example.COM", role: "operator" });
  assert.equal(r.success, true);
  assert.equal(r.data!.email, "ann@example.com");
});

test("signup: enforces password length", () => {
  assert.equal(signupSchema.safeParse({ fullName: "A", email: "a@b.co", password: "short" }).success, false);
  assert.equal(signupSchema.safeParse({ fullName: "A", email: "a@b.co", password: "long-enough" }).success, true);
});

test("filters: invalid URL values are dropped rather than trusted", () => {
  const f = incidentFilterSchema.parse({ status: "bogus", facility: "not-a-uuid", type: "shortage", from: "2026-13-99x", page: "-5" });
  assert.equal(f.status, undefined);
  assert.equal(f.facility, undefined);
  assert.equal(f.type, "shortage");
  assert.equal(f.from, undefined);
  assert.equal(f.page, undefined);
});

test("search: strips PostgREST filter syntax characters", () => {
  assert.equal(sanitizeSearch("po,status.eq.closed)"), "po status eq closed");
  assert.equal(sanitizeSearch("abc*%\\"), "abc");
});

test("safeNext: blocks open redirects", () => {
  assert.equal(safeNext("/incidents/1"), "/incidents/1");
  assert.equal(safeNext("https://evil.com"), "/dashboard");
  assert.equal(safeNext("//evil.com"), "/dashboard");
  assert.equal(safeNext("/\\evil.com"), "/dashboard");
  assert.equal(safeNext(null, "/x"), "/x");
});
