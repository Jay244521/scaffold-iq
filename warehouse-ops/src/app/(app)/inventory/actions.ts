"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAppContext, type AppContext } from "@/lib/context";
import { MAX_CSV_BYTES, parseCsv } from "@/lib/csv-parse";
import { friendlyError, logError } from "@/lib/errors";
import {
  FIELD_LABELS,
  INVENTORY_FIELDS,
  buildLines,
  classifyLines,
  mapColumns,
  recordKey,
  type ClassifiedLine,
  type InventoryField,
  type InventoryLine,
} from "@/lib/inventory";
import { can } from "@/lib/permissions";

export type PreviewResult = {
  error?: string;
  fileName?: string;
  columns?: { field: InventoryField; label: string; header: string | null }[];
  counts?: { total: number; discrepancy: number; new_item: number; match: number; invalid: number };
  lines?: ClassifiedLine[];
  truncated?: boolean;
};

type Parsed = { error: string } | { fileName: string; facilityId: string; source: "count" | "system"; headers: string[]; map: ReturnType<typeof mapColumns>["map"]; lines: InventoryLine[] };

/** Reads and validates the uploaded file on the server. Never trusts anything parsed in the browser. */
async function readUpload(ctx: AppContext, formData: FormData): Promise<Parsed> {
  if (!can.importInventory(ctx.org.role)) return { error: "Your role can't import inventory files." };
  const facilityId = String(formData.get("facilityId") ?? "");
  if (!ctx.facilities.some((f) => f.id === facilityId && f.is_active)) return { error: "Choose one of your active facilities." };
  const source = formData.get("source") === "system" ? "system" : "count";
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a CSV file to upload." };
  if (file.size > MAX_CSV_BYTES) return { error: "The file is larger than 2 MB. Split it into smaller files." };
  if (!/\.(csv|txt)$/i.test(file.name)) return { error: "Upload a .csv file. In Excel or Google Sheets use File → Save as / Download → CSV." };

  const parsed = parseCsv(await file.text());
  if (!parsed.ok) return { error: parsed.error };
  const { map, missing } = mapColumns(parsed.headers);
  if (missing.length) {
    return {
      error: `Required column${missing.length > 1 ? "s" : ""} not found: ${missing.map((m) => FIELD_LABELS[m]).join(" and ")}. ` +
        `Columns in your file: ${parsed.headers.filter(Boolean).slice(0, 12).join(", ") || "none"}. Rename the header row (e.g. "SKU" and "Qty") or use the template.`,
    };
  }
  const lines = buildLines(parsed.rows, map);
  if (lines.length === 0) return { error: "The file has a header row but no data rows." };
  return { fileName: file.name.replace(/[\u0000-\u001f]/g, "").slice(0, 200), facilityId, source, headers: parsed.headers, map, lines };
}

async function recordsFor(ctx: AppContext, facilityId: string, skus: string[]) {
  const records = new Map<string, number>();
  const unique = [...new Set(skus.filter(Boolean))];
  for (let i = 0; i < unique.length; i += 300) {
    const { data, error } = await ctx.supabase
      .from("inventory_items")
      .select("sku, location, on_hand")
      .eq("org_id", ctx.org.orgId)
      .eq("facility_id", facilityId)
      .in("sku", unique.slice(i, i + 300));
    if (error) logError("inventory preview records", error);
    for (const r of data ?? []) records.set(recordKey(r.sku as string, r.location as string), Number(r.on_hand));
  }
  return records;
}

/** Step 1: check the file and compare it with current records. Saves nothing. */
export async function previewInventoryFile(formData: FormData): Promise<PreviewResult> {
  const ctx = await requireAppContext();
  const up = await readUpload(ctx, formData);
  if ("error" in up) return { error: up.error };
  const classified = classifyLines(up.lines, await recordsFor(ctx, up.facilityId, up.lines.map((l) => l.sku)));
  const count = (s: string) => classified.filter((l) => l.status === s).length;
  // Show problems and differences first.
  const order = { invalid: 0, discrepancy: 1, new_item: 2, match: 3 } as const;
  const sorted = [...classified].sort((a, b) => order[a.status] - order[b.status] || a.line_no - b.line_no);
  return {
    fileName: up.fileName,
    columns: INVENTORY_FIELDS.map((f) => ({ field: f, label: FIELD_LABELS[f], header: up.map[f] === undefined ? null : up.headers[up.map[f]!] })),
    counts: { total: classified.length, discrepancy: count("discrepancy"), new_item: count("new_item"), match: count("match"), invalid: count("invalid") },
    lines: sorted.slice(0, 300),
    truncated: sorted.length > 300,
  };
}

/** Step 2: save the file for review. The database re-validates every line. No quantities change. */
export async function saveInventoryImport(formData: FormData): Promise<{ error?: string; importId?: string }> {
  const ctx = await requireAppContext();
  const up = await readUpload(ctx, formData);
  if ("error" in up) return { error: up.error };
  const { data, error } = await ctx.supabase.rpc("create_inventory_import", {
    p_org: ctx.org.orgId,
    p_facility: up.facilityId,
    p_source: up.source,
    p_file_name: up.fileName,
    p_lines: up.lines,
  });
  if (error || !data) {
    logError("create_inventory_import", error);
    return { error: friendlyError(error) };
  }
  revalidatePath("/inventory");
  return { importId: data as string };
}

const idSchema = z.uuid();

/** Approve / reject selected lines (managers and above). */
export async function decideInventoryLines(formData: FormData) {
  const ctx = await requireAppContext();
  const importId = idSchema.safeParse(formData.get("importId"));
  if (!importId.success || !can.approveInventory(ctx.org.role)) return;
  let decision = String(formData.get("decision") ?? "");
  const all = decision === "approve_all";
  if (all) decision = "approved";
  let lineIds = formData.getAll("lineId").map(String).filter((v) => idSchema.safeParse(v).success);
  if (all) {
    const { data } = await ctx.supabase
      .from("inventory_import_lines")
      .select("id")
      .eq("import_id", importId.data)
      .in("status", ["discrepancy", "new_item"])
      .limit(5000);
    lineIds = (data ?? []).map((d) => d.id as string);
  }
  if (!["approved", "rejected", "pending"].includes(decision) || lineIds.length === 0) {
    redirect(`/inventory/imports/${importId.data}?notice=select`);
  }
  const { error } = await ctx.supabase.rpc("decide_inventory_lines", { p_import: importId.data, p_line_ids: lineIds, p_decision: decision });
  if (error) logError("decide_inventory_lines", error);
  revalidatePath(`/inventory/imports/${importId.data}`);
  redirect(`/inventory/imports/${importId.data}?notice=${error ? "error" : "decided"}${formData.get("show") ? `&show=${formData.get("show")}` : ""}`);
}

/** Apply approved corrections (managers and above). Requires an explicit confirmation tick. */
export async function applyInventoryImport(formData: FormData) {
  const ctx = await requireAppContext();
  const importId = idSchema.safeParse(formData.get("importId"));
  if (!importId.success || !can.approveInventory(ctx.org.role)) return;
  if (formData.get("confirm") !== "yes") redirect(`/inventory/imports/${importId.data}?notice=confirm`);
  const { data, error } = await ctx.supabase.rpc("apply_inventory_import", { p_import: importId.data });
  if (error) {
    logError("apply_inventory_import", error);
    redirect(`/inventory/imports/${importId.data}?notice=error`);
  }
  const r = data as { applied: number; stale: number };
  revalidatePath("/inventory");
  redirect(`/inventory/imports/${importId.data}?notice=applied&applied=${r.applied}&stale=${r.stale}`);
}

export async function discardInventoryImport(formData: FormData) {
  const ctx = await requireAppContext();
  const importId = idSchema.safeParse(formData.get("importId"));
  if (!importId.success) return;
  const { error } = await ctx.supabase.rpc("discard_inventory_import", { p_import: importId.data });
  if (error) logError("discard_inventory_import", error);
  revalidatePath("/inventory");
  redirect(`/inventory/imports/${importId.data}?notice=${error ? "error" : "discarded"}`);
}
