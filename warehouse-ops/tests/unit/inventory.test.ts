import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCsv } from "../../src/lib/csv-parse";
import { buildLines, classifyLines, mapColumns, parseNumber, recordKey } from "../../src/lib/inventory";

test("CSV: quotes, escaped quotes, CRLF, BOM and blank lines", () => {
  const r = parseCsv('﻿SKU,Description,Qty\r\n"A-1","Box, ""large""",10\r\n\r\nB-2,Tape,5\r\n');
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.deepEqual(r.headers, ["SKU", "Description", "Qty"]);
  assert.deepEqual(r.rows[0], ["A-1", 'Box, "large"', "10"]);
  assert.deepEqual(r.rows.filter((x) => x.some(Boolean)).length, 2);
});

test("CSV: detects semicolon and tab delimiters", () => {
  const s = parseCsv("sku;qty\nA;1\n");
  assert.ok(s.ok && s.delimiter === ";" && s.rows[0][1] === "1");
  const t = parseCsv("sku\tqty\nA\t1\n");
  assert.ok(t.ok && t.delimiter === "\t");
});

test("CSV: rejects binary, empty, unclosed quotes and too many rows", () => {
  assert.equal(parseCsv("PK\u0003\u0004\u0000").ok, false);
  assert.equal(parseCsv("   ").ok, false);
  assert.equal(parseCsv('sku,qty\n"A,1\n').ok, false);
  assert.equal(parseCsv("sku,qty\n" + "A,1\n".repeat(11), 10).ok, false);
});

test("columns: common header names are recognized; required ones reported", () => {
  const a = mapColumns(["Item Number", "Bin Location", "Qty On Hand", "Unit Cost"]);
  assert.deepEqual(a.missing, []);
  assert.equal(a.map.sku, 0);
  assert.equal(a.map.location, 1);
  assert.equal(a.map.qty, 2);
  assert.equal(a.map.unit_cost, 3);
  assert.deepEqual(mapColumns(["Description", "Location"]).missing, ["sku", "qty"]);
});

test("numbers: thousands separators ok; negatives, text and too many decimals rejected", () => {
  assert.equal(parseNumber("1,234"), 1234);
  assert.equal(parseNumber("12.5"), 12.5);
  assert.equal(parseNumber("0"), 0);
  assert.equal(parseNumber("-3"), null);
  assert.equal(parseNumber("ten"), null);
  assert.equal(parseNumber("1.23456"), null);
  assert.equal(parseNumber("=1+1"), null);
});

test("rows: missing and invalid values get clear messages with spreadsheet line numbers", () => {
  const { map } = mapColumns(["sku", "qty"]);
  const lines = buildLines([["A", "5"], ["", "1"], ["B", ""], ["C", "abc"], ["D", "-2"], ["", ""]], map);
  assert.equal(lines.length, 5, "blank rows are skipped");
  assert.equal(lines[0].line_no, 2);
  assert.equal(lines[1].error, "Missing SKU");
  assert.equal(lines[2].error, "Missing quantity");
  assert.equal(lines[3].error, 'Invalid quantity "abc"');
  assert.equal(lines[4].error, "Quantity cannot be negative");
});

test("comparison: discrepancy, match, new item and duplicates", () => {
  const { map } = mapColumns(["sku", "location", "qty"]);
  const lines = buildLines([["A", "L1", "90"], ["B", "", "50"], ["NEW", "", "3"], ["D", "", "1"], ["D", "", "2"]], map);
  const records = new Map([[recordKey("A", "L1"), 100], [recordKey("B", ""), 50]]);
  const c = classifyLines(lines, records);
  assert.equal(c[0].status, "discrepancy");
  assert.equal(c[0].variance, -10);
  assert.equal(c[1].status, "match");
  assert.equal(c[2].status, "new_item");
  assert.ok(c[3].status === "invalid" && c[3].error!.startsWith("Duplicate"));
  assert.equal(c[4].status, "invalid");
});
