/**
 * CSV writing that is safe to open in Excel / Google Sheets.
 * Text that starts with = + - @ tab or carriage return is prefixed with an apostrophe
 * so a spreadsheet treats it as text instead of running it as a formula
 * ("CSV injection"). Numbers are written as plain numbers.
 */
export type CsvValue = string | number | null | undefined;

export function csvCell(v: CsvValue): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "";
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export function toCsv(headers: string[], rows: CsvValue[][]): string {
  const lines = [headers.map(csvCell).join(","), ...rows.map((r) => r.map(csvCell).join(","))];
  // Byte-order mark so Excel opens UTF-8 (names with accents) correctly.
  return "﻿" + lines.join("\r\n") + "\r\n";
}
