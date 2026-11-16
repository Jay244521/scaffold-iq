import { test } from "node:test";
import assert from "node:assert/strict";
import { csvCell, toCsv } from "../../src/lib/csv";

test("text is quoted and quotes are doubled", () => {
  assert.equal(csvCell('He said "short"'), '"He said ""short"""');
  assert.equal(csvCell("a,b\nc"), '"a,b\nc"');
});

test("spreadsheet formulas are neutralized (CSV injection)", () => {
  assert.equal(csvCell('=HYPERLINK("http://evil","x")'), '"\'=HYPERLINK(""http://evil"",""x"")"');
  for (const p of ["+1", "-2+3", "@SUM(A1)", "\tcmd", "\rcmd"]) assert.ok(csvCell(p).startsWith(`"'`), p);
});

test("numbers stay numeric, including negatives; empty values are blank", () => {
  assert.equal(csvCell(-8), "-8");
  assert.equal(csvCell(12.5), "12.5");
  assert.equal(csvCell(null), "");
  assert.equal(csvCell(undefined), "");
  assert.equal(csvCell(NaN), "");
});

test("whole file has a BOM, header row and CRLF line endings", () => {
  const out = toCsv(["A", "B"], [["x", 1]]);
  assert.equal(out, '﻿"A","B"\r\n"x",1\r\n');
});
