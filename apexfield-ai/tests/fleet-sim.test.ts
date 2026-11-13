import { test } from "node:test";
import assert from "node:assert/strict";
import { filterCounts, fleetReducer, initialFleetState, selectTechs } from "@/lib/fleet-sim";

test("demo fleet: seeded counts, sorting and search", () => {
  const s = initialFleetState();
  assert.deepEqual(filterCounts(s.techs), { all: 12, attention: 4, apprentices: 6, in_progress: 10, completed: 2 });
  assert.deepEqual(selectTechs(s.techs, "all", "").slice(0, 4).map((t) => t.status), ["escalated", "escalated", "safety_hold", "safety_hold"]);
  assert.equal(selectTechs(s.techs, "all", "truck-07")[0].name, "Andre Jackson");
});

test("auto-tick: escalations and seeded holds wait for the manager; manager actions work once", () => {
  let s = initialFleetState();
  for (let i = 0; i < 60; i++) s = fleetReducer(s, { type: "tick" });
  const t = (id: string) => s.techs.find((x) => x.id === id)!;
  assert.equal(t("t03").status, "escalated");
  assert.equal(t("t02").status, "safety_hold");
  s = fleetReducer(s, { type: "whisper", id: "t03", text: "  Check the flex run  " });
  assert.equal(t("t03").transcript.at(-2)?.text, "Check the flex run");
  s = fleetReducer(s, { type: "clear", id: "t02" });
  assert.ok(t("t02").safetyVerified && t("t02").currentStep === 4);
  s = fleetReducer(s, { type: "dispatch", id: "t04" });
  assert.strictEqual(fleetReducer(s, { type: "dispatch", id: "t04" }), s);
});
