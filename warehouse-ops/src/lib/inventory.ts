/**
 * Inventory file rules: column matching, row validation and comparison with records.
 * The database re-checks all of this when an import is saved; this module gives the
 * user an accurate preview first.
 */
export const INVENTORY_FIELDS = ["sku", "qty", "location", "description", "unit_cost"] as const;
export type InventoryField = (typeof INVENTORY_FIELDS)[number];
export const REQUIRED_FIELDS: InventoryField[] = ["sku", "qty"];

export const FIELD_LABELS: Record<InventoryField, string> = {
  sku: "SKU / item number",
  qty: "Quantity",
  location: "Location / bin",
  description: "Description",
  unit_cost: "Unit cost",
};

const ALIASES: Record<InventoryField, string[]> = {
  sku: ["sku", "item", "item number", "item no", "item #", "item code", "part", "part number", "part no", "product code", "material", "upc"],
  qty: ["qty", "quantity", "counted", "counted qty", "count", "count qty", "on hand", "qty on hand", "quantity on hand", "system qty", "available", "physical qty"],
  location: ["location", "loc", "bin", "bin location", "slot", "aisle"],
  description: ["description", "desc", "item description", "product", "product name", "name"],
  unit_cost: ["unit cost", "cost", "unit price", "price", "standard cost"],
};

export const normalizeHeader = (h: string) => h.toLowerCase().replace(/[_\-.]+/g, " ").replace(/\s+/g, " ").trim();

export type ColumnMap = Partial<Record<InventoryField, number>>;

export function mapColumns(headers: string[]): { map: ColumnMap; missing: InventoryField[] } {
  const map: ColumnMap = {};
  const normalized = headers.map(normalizeHeader);
  for (const field of INVENTORY_FIELDS) {
    const idx = normalized.findIndex((h, i) => ALIASES[field].includes(h) && !Object.values(map).includes(i));
    if (idx >= 0) map[field] = idx;
  }
  return { map, missing: REQUIRED_FIELDS.filter((f) => map[f] === undefined) };
}

/** Parses a non-negative quantity with up to 3 decimals. Accepts 1,234.5 thousands separators. */
export function parseNumber(raw: string, decimals = 3): number | null {
  let s = raw.trim();
  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, "");
  const re = new RegExp(`^\\d+(\\.\\d{1,${decimals}})?$`);
  if (!re.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export type InventoryLine = {
  line_no: number;
  sku: string;
  location: string;
  description: string | null;
  qty: number | null;
  unit_cost: number | null;
  error: string | null;
};

export function buildLines(rows: string[][], map: ColumnMap): InventoryLine[] {
  const get = (r: string[], f: InventoryField) => (map[f] === undefined ? "" : (r[map[f]!] ?? "").trim());
  const lines: InventoryLine[] = [];
  rows.forEach((r, i) => {
    if (!r.some((v) => v.trim() !== "")) return; // skip blank rows
    const sku = get(r, "sku");
    const rawQty = get(r, "qty");
    const rawCost = get(r, "unit_cost");
    const qty = rawQty === "" ? null : parseNumber(rawQty);
    const unitCost = rawCost === "" ? null : parseNumber(rawCost.replace(/^\$/, ""), 4);
    let error: string | null = null;
    if (!sku) error = "Missing SKU";
    else if (sku.length > 64) error = "SKU is longer than 64 characters";
    else if (rawQty === "") error = "Missing quantity";
    else if (qty === null) error = rawQty.startsWith("-") ? "Quantity cannot be negative" : `Invalid quantity "${rawQty.slice(0, 20)}"`;
    else if (get(r, "location").length > 64) error = "Location is longer than 64 characters";
    else if (rawCost !== "" && unitCost === null) error = `Invalid unit cost "${rawCost.slice(0, 20)}"`;
    lines.push({
      line_no: i + 2, // +1 for the header row, +1 because spreadsheet rows start at 1
      sku: sku.slice(0, 100),
      location: get(r, "location").slice(0, 100),
      description: get(r, "description").slice(0, 300) || null,
      qty: error ? null : qty,
      unit_cost: unitCost,
      error,
    });
  });
  return lines;
}

export type LineStatus = "match" | "discrepancy" | "new_item" | "invalid";
export type ClassifiedLine = InventoryLine & { status: LineStatus; recorded: number | null; variance: number | null };

export const recordKey = (sku: string, location: string) => `${sku}\u0000${location}`;

/** Same rules the database applies on save; used for the preview. */
export function classifyLines(lines: InventoryLine[], records: Map<string, number>): ClassifiedLine[] {
  const counts = new Map<string, number[]>();
  for (const l of lines) if (!l.error) counts.set(recordKey(l.sku, l.location), [...(counts.get(recordKey(l.sku, l.location)) ?? []), l.line_no]);
  return lines.map((l) => {
    const dupes = counts.get(recordKey(l.sku, l.location));
    if (l.error || (dupes && dupes.length > 1)) {
      return { ...l, status: "invalid", recorded: null, variance: null, error: l.error ?? `Duplicate SKU and location in this file (lines ${dupes!.join(", ")})` };
    }
    const recorded = records.get(recordKey(l.sku, l.location)) ?? null;
    if (recorded === null) return { ...l, status: "new_item", recorded, variance: null };
    const variance = Math.round((l.qty! - recorded) * 1000) / 1000;
    return { ...l, status: variance === 0 ? "match" : "discrepancy", recorded, variance };
  });
}

export const LINE_STATUS_LABELS: Record<string, string> = {
  match: "Matches record",
  discrepancy: "Discrepancy",
  new_item: "Not in records",
  invalid: "Invalid",
  stale: "Record changed",
};
