import { test } from "node:test";
import assert from "node:assert/strict";
import { csvCell, sessionsToCsv } from "@/lib/session-export";
import type { DbSession } from "@/lib/live-fleet";

test("cells are quoted per RFC 4180 and formula-looking text is defused", () => {
  assert.equal(csvCell('He said "hi", then left'), '"He said ""hi"", then left"');
  assert.equal(csvCell("=HYPERLINK(\"http://x\")"), `"'=HYPERLINK(""http://x"")"`);
  assert.equal(csvCell("+1 call"), "'+1 call");
  assert.equal(csvCell(["strap", "insulation"]), "strap; insulation");
  assert.equal(csvCell(null), "");
});

test("sessions export with tech, equipment, duration and reading counts", () => {
  const s: DbSession & { consent_acknowledged_at: string } = {
    id: "s1", org_id: "o", tech_id: "t1", status: "completed", reported_symptom: "No cooling, line 2", current_step_index: 5,
    safety_disconnect_verified: true, confirmed_root_cause: "TXV bulb loose", parts_replaced: ["bulb strap"], ai_summary_report: "Re-strapped, SC 10F",
    started_at: "2026-11-18T14:00:00.000Z", completed_at: "2026-11-18T14:42:00.000Z", consent_acknowledged_at: "2026-11-18T13:59:00.000Z",
    equipment_units: { manufacturer: "Carrier", model_number: "24ACC636A003", equipment_type: "split_ac", refrigerant_type: "R-410A", tonnage: 3 },
    diagnostic_readings: [
      { id: "r1", reading_type: "subcooling", numeric_value: 4.2, unit: "degF", is_within_spec: false, recorded_at: "2026-11-18T14:20:00.000Z" },
      { id: "r2", reading_type: "voltage", numeric_value: 24.4, unit: "volts", is_within_spec: true, recorded_at: "2026-11-18T14:10:00.000Z" },
    ],
    diagnostic_steps: [],
  };
  const csv = sessionsToCsv([s], [{ id: "t1", full_name: "Diego Ramirez", role: "tech", experience_years: 4, truck_label: "TRUCK-01" }]);
  const [header, row] = csv.split("\r\n");
  assert.ok(header.startsWith("started_at,technician,truck,status"));
  assert.equal(row, '2026-11-18T14:00:00.000Z,Diego Ramirez,TRUCK-01,completed,Carrier,24ACC636A003,split_ac,"No cooling, line 2",TXV bulb loose,bulb strap,42,2,1,yes,,2026-11-18T13:59:00.000Z,"Re-strapped, SC 10F",s1');
});
