import { test } from "node:test";
import assert from "node:assert/strict";
import { runOemLookup } from "@/lib/ai/oem-lookup-client";

const equipment = { manufacturer: "Carrier", model_number: "24ACC636A003", equipment_type: "split_ac", at: "x" } as never;
let lastBody: Record<string, unknown> | null = null;
const fakeFetch = (reply: unknown, status = 200) =>
  (async (_u: string, init: { body: string }) => {
    lastBody = JSON.parse(init.body);
    return { ok: status < 400, status, json: async () => reply };
  }) as unknown as typeof fetch;

test("refuses before a data plate is registered", async () => {
  const r = await runOemLookup({ query: "subcooling" }, null, fakeFetch({}));
  assert.equal(r.record.status, "blocked");
  assert.ok("error" in r.response);
});

test("scopes the request to the registered unit and returns cited excerpts", async () => {
  const r = await runOemLookup({ query: "target subcooling", chunk_type: "charging_chart" }, equipment, fakeFetch({
    found: true, available: true, results: [{ source: "Carrier 24ACC6 › Install › Charging (p.14)", chunk_type: "charging_chart", pages: "p.14", excerpt: "| 95.0 | 358 | 10 |" }],
  }));
  assert.deepEqual(lastBody, { query: "target subcooling", chunk_type: "charging_chart", manufacturer: "Carrier", model: "24ACC636A003" });
  assert.equal(r.record.status, "found");
  assert.deepEqual(r.record.sources, ["Carrier 24ACC6 › Install › Charging (p.14)"]);
});

test("not found, offline and HTTP failures fall back to labelled general practice", async () => {
  for (const [reply, status, expected] of [
    [{ found: false, available: true, results: [] }, 200, "none"],
    [{ found: false, available: false, results: [] }, 200, "unavailable"],
    [{}, 502, "error"],
  ] as const) {
    const r = await runOemLookup({ query: "E4 code" }, equipment, fakeFetch(reply, status));
    assert.equal(r.record.status, expected);
    assert.ok("output" in r.response && /general field practice/.test(JSON.stringify(r.response)));
  }
});
