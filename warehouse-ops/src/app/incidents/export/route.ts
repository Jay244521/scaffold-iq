import { NextResponse, type NextRequest } from "next/server";
import { toCsv } from "@/lib/csv";
import { getMembers, requireAppContext } from "@/lib/context";
import { logError } from "@/lib/errors";
import { incidentQuery } from "@/lib/incident-query";
import { EXCEPTION_LABELS, STATUS_LABELS, incidentRef, type ExceptionType, type IncidentStatus } from "@/lib/labels";
import { incidentFilterSchema } from "@/lib/validation";

const MAX_ROWS = 10_000;

type Row = {
  id: string;
  number: number;
  type: ExceptionType;
  status: IncidentStatus;
  occurred_at: string;
  created_at: string;
  resolved_at: string | null;
  po_number: string | null;
  shipment_ref: string | null;
  sku: string | null;
  item_description: string | null;
  expected_qty: number | null;
  received_qty: number | null;
  description: string;
  resolution_notes: string | null;
  reported_by: string | null;
  assigned_to: string | null;
  suppliers: { name: string } | null;
  facilities: { name: string } | null;
};

/** CSV export of incidents matching the same filters as the incident list / reports. */
export async function GET(request: NextRequest) {
  const ctx = await requireAppContext();
  const raw = Object.fromEntries(request.nextUrl.searchParams.entries());
  const filters = incidentFilterSchema.parse(raw);
  const { query } = await incidentQuery(
    ctx,
    filters,
    "id, number, type, status, occurred_at, created_at, resolved_at, po_number, shipment_ref, sku, item_description, expected_qty, received_qty, description, resolution_notes, reported_by, assigned_to, suppliers(name), facilities(name)",
  );
  const { data, error } = await query.range(0, MAX_ROWS - 1);
  if (error) {
    logError("export incidents", error);
    return new NextResponse("Export failed. Please try again.", { status: 500 });
  }
  const members = await getMembers(ctx.org.orgId);
  const { data: bolRows } = await ctx.supabase
    .from("incident_attachments")
    .select("incident_id")
    .eq("org_id", ctx.org.orgId)
    .eq("kind", "signed_bol")
    .limit(MAX_ROWS * 5);
  const hasBol = new Set((bolRows ?? []).map((b) => b.incident_id as string));
  const name = (id: string | null) => (id ? (members.find((m) => m.userId === id)?.name ?? "Former member") : "");
  const num = (v: number | null) => (v === null ? null : Number(v));

  const csv = toCsv(
    [
      "Reference", "Occurred (UTC)", "Reported (UTC)", "Facility", "Category", "Status", "Supplier", "PO number",
      "Shipment reference", "SKU", "Item", "Expected qty", "Received qty", "Variance", "Reported by", "Responsible",
      "Resolved (UTC)", "Hours to resolve", "Signed BOL attached", "Resolution notes", "Description",
    ],
    ((data ?? []) as unknown as Row[]).map((r) => {
      const exp = num(r.expected_qty);
      const rec = num(r.received_qty);
      const hours = r.resolved_at ? Math.round(((Date.parse(r.resolved_at) - Date.parse(r.created_at)) / 3_600_000) * 10) / 10 : null;
      return [
        incidentRef(r.number), r.occurred_at, r.created_at, r.facilities?.name, EXCEPTION_LABELS[r.type], STATUS_LABELS[r.status],
        r.suppliers?.name, r.po_number, r.shipment_ref, r.sku, r.item_description, exp, rec,
        exp !== null && rec !== null ? Math.round((rec - exp) * 1000) / 1000 : null,
        name(r.reported_by), name(r.assigned_to), r.resolved_at, hours, hasBol.has(r.id) ? "Yes" : "No", r.resolution_notes, r.description,
      ];
    }),
  );

  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="incidents-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
