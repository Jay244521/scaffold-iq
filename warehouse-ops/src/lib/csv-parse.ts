/**
 * Small, strict CSV reader for uploaded inventory files (RFC 4180 style).
 * Handles quoted fields, escaped quotes ("") and CR/LF line endings, detects comma,
 * semicolon or tab delimiters, and refuses binary data and oversized files.
 */
export const MAX_CSV_BYTES = 2 * 1024 * 1024;
export const MAX_CSV_ROWS = 5000;

export type ParsedCsv = { ok: true; headers: string[]; rows: string[][]; delimiter: string } | { ok: false; error: string };

export function parseCsv(input: string, maxRows = MAX_CSV_ROWS): ParsedCsv {
  const text = input.replace(/^﻿/, "");
  if (text.includes("\u0000")) return { ok: false, error: "This doesn't look like a CSV text file." };
  if (!text.trim()) return { ok: false, error: "The file is empty." };

  const firstLine = text.slice(0, text.search(/\r?\n|$/));
  const delimiter = [",", ";", "\t"].reduce((best, d) => (firstLine.split(d).length > firstLine.split(best).length ? d : best), ",");

  const records: string[][] = [];
  let field = "";
  let record: string[] = [];
  let inQuotes = false;
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
      } else {
        field += c;
      }
      i++;
      continue;
    }
    if (c === '"' && field === "") {
      inQuotes = true;
    } else if (c === delimiter) {
      record.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      record.push(field);
      records.push(record);
      field = "";
      record = [];
      if (c === "\r" && text[i + 1] === "\n") i++;
      if (records.length > maxRows + 1) return { ok: false, error: `The file has more than ${maxRows.toLocaleString()} rows. Split it into smaller files.` };
    } else {
      field += c;
    }
    i++;
  }
  if (inQuotes) return { ok: false, error: "The file has an unclosed quote (\"). Check it was saved as CSV." };
  if (field !== "" || record.length) {
    record.push(field);
    records.push(record);
  }

  const nonEmpty = records.filter((r) => r.some((v) => v.trim() !== ""));
  if (nonEmpty.length === 0) return { ok: false, error: "The file is empty." };
  const [headers, ...rows] = records[0].some((v) => v.trim() !== "") ? records : nonEmpty;
  if (rows.length > maxRows) return { ok: false, error: `The file has more than ${maxRows.toLocaleString()} rows. Split it into smaller files.` };
  return { ok: true, headers: headers.map((h) => h.trim()), rows, delimiter };
}
