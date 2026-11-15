import { test } from "node:test";
import assert from "node:assert/strict";
import { atLeast, can, canUpdateIncident, grantableRoles, invitableRoles } from "../../src/lib/permissions";

test("role ordering", () => {
  assert.ok(atLeast("owner", "admin"));
  assert.ok(atLeast("supervisor", "operator"));
  assert.ok(!atLeast("viewer", "operator"));
  assert.ok(!atLeast(null, "viewer"));
});

test("capabilities match the database rules", () => {
  assert.ok(!can.createIncident("viewer"));
  assert.ok(can.createIncident("operator"));
  assert.ok(!can.assign("operator"));
  assert.ok(can.assign("supervisor"));
  assert.ok(!can.manageFacilities("supervisor"));
  assert.ok(can.manageFacilities("manager"));
  assert.ok(!can.manageTeam("manager"));
  assert.ok(can.manageTeam("admin"));
});

test("operators can update only incidents they reported or own", () => {
  const inc = { reported_by: "u1", assigned_to: "u2" };
  assert.ok(canUpdateIncident("operator", "u1", inc));
  assert.ok(canUpdateIncident("operator", "u2", inc));
  assert.ok(!canUpdateIncident("operator", "u3", inc));
  assert.ok(!canUpdateIncident("viewer", "u1", inc));
  assert.ok(canUpdateIncident("supervisor", "u3", inc));
});

test("only owners grant owner; nobody invites an owner", () => {
  assert.ok(grantableRoles("owner").includes("owner"));
  assert.ok(!grantableRoles("admin").includes("owner"));
  assert.deepEqual(grantableRoles("manager"), []);
  assert.ok(!invitableRoles("owner").includes("owner"));
});
