import { test } from "node:test";
import assert from "node:assert/strict";
import { formatZonedDateTime, isValidTimeZone, zonedDayStart } from "../../src/lib/timezone";

test("a calendar day starts at local midnight, not UTC midnight", () => {
  assert.equal(zonedDayStart("2026-11-14", "America/Chicago"), "2026-11-14T06:00:00.000Z"); // CST, UTC-6
  assert.equal(zonedDayStart("2026-07-14", "America/Chicago"), "2026-07-14T05:00:00.000Z"); // CDT, UTC-5
  assert.equal(zonedDayStart("2026-11-14", "UTC"), "2026-11-14T00:00:00.000Z");
  assert.equal(zonedDayStart("2026-11-14", "Asia/Kolkata"), "2026-11-13T18:30:00.000Z");
});

test("daylight-saving change days are handled", () => {
  assert.equal(zonedDayStart("2026-03-08", "America/New_York"), "2026-03-08T05:00:00.000Z"); // spring forward day starts in EST
  assert.equal(zonedDayStart("2026-11-01", "America/New_York"), "2026-11-01T04:00:00.000Z"); // fall back day starts in EDT
});

test("a 7 pm Texas incident stays on the same day", () => {
  // 7:05 pm CST on Nov 14 is 01:05 UTC on Nov 15.
  assert.equal(formatZonedDateTime("2026-11-15T01:05:00Z", "America/Chicago"), "2026-11-14 19:05");
  const start = Date.parse(zonedDayStart("2026-11-14", "America/Chicago"));
  const end = Date.parse(zonedDayStart("2026-11-15", "America/Chicago"));
  const t = Date.parse("2026-11-15T01:05:00Z");
  assert.ok(t >= start && t < end);
});

test("time zone validation", () => {
  assert.ok(isValidTimeZone("America/Chicago"));
  assert.ok(!isValidTimeZone("Mars/Olympus"));
  assert.ok(!isValidTimeZone(""));
});
