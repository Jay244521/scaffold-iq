import { test } from "node:test";
import assert from "node:assert/strict";
import { describeAudit, type AuditEntry } from "../../src/lib/audit";

const names = (u: string | null) => ({ u1: "Tom Kowalski" } as Record<string, string>)[u ?? ""] ?? "a former member";
const e = (entity_type: string, action: AuditEntry["action"], old?: object, nw?: object): AuditEntry =>
  ({ id: 1, actor_id: null, action, entity_type, entity_id: null, details: { old: old as never, new: nw as never }, created_at: "" });

test("membership and invitation entries read naturally", () => {
  assert.equal(describeAudit(e("memberships", "update", { user_id: "u1", role: "operator" }, { user_id: "u1", role: "supervisor" }), names),
    "changed Tom Kowalski's role from Operator to Supervisor");
  assert.equal(describeAudit(e("memberships", "insert", undefined, { user_id: "u2", role: "viewer" }), names), "added a former member as Viewer");
  assert.equal(describeAudit({ ...e("memberships", "insert", undefined, { user_id: "u1", role: "operator" }), actor_id: "u1" }, names), "joined as Operator");
  assert.equal(describeAudit(e("invitations", "insert", undefined, { email: "a@b.co", role: "operator" }), names), "invited a@b.co as Operator");
  assert.equal(describeAudit(e("invitations", "update", { email: "a@b.co", revoked_at: null }, { email: "a@b.co", revoked_at: "x" }), names), "revoked the invitation for a@b.co");
});

test("facility, supplier and inventory entries", () => {
  assert.equal(describeAudit(e("facilities", "update", { name: "Dallas", is_active: true }, { name: "Dallas", is_active: false }), names), "deactivated facility Dallas");
  assert.equal(describeAudit(e("suppliers", "update", { name: "Acme" }, { name: "Acme Packaging" }), names), "renamed supplier Acme to Acme Packaging");
  assert.equal(describeAudit(e("suppliers", "delete", { name: "ACME Inc." }), names), "removed supplier ACME Inc. (merged or deleted)");
  assert.equal(describeAudit(e("inventory_items", "update", { sku: "A", location: "L1", on_hand: 100 }, { sku: "A", location: "L1", on_hand: 95 }), names),
    "changed A @ L1 on hand from 100 to 95");
  assert.equal(describeAudit(e("inventory_imports", "update", { status: "pending_review", file_name: "c.csv" }, { status: "applied", file_name: "c.csv", applied_rows: 3 }), names),
    "applied inventory file c.csv (3 corrections)");
});
