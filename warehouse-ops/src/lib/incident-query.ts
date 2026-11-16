import "server-only";
import type { AppContext } from "@/lib/context";
import { sanitizeSearch, type IncidentFilters } from "@/lib/validation";

/** Turns a YYYY-MM-DD date into the UTC timestamp range used by list, reports and export. */
export function dayRange(from?: string, to?: string) {
  return {
    fromIso: from ? `${from}T00:00:00Z` : null,
    toIso: to ? new Date(Date.parse(`${to}T00:00:00Z`) + 86_400_000).toISOString() : null,
  };
}

/** The facility filter to use: a valid facility from the URL, else the user's selected facility. */
export const effectiveFacility = (ctx: AppContext, f: IncidentFilters) =>
  f.facility && ctx.facilities.some((x) => x.id === f.facility) ? f.facility : ctx.facility?.id;

/**
 * Builds the incidents query for the active organization with the given filters.
 * Shared by the incident list and CSV export so they always agree. RLS still applies.
 */
export async function incidentQuery(ctx: AppContext, f: IncidentFilters, select: string, count = false) {
  let q = ctx.supabase
    .from("incidents")
    .select(select, count ? { count: "exact" } : undefined)
    .eq("org_id", ctx.org.orgId);

  const facilityId = effectiveFacility(ctx, f);
  if (facilityId) q = q.eq("facility_id", facilityId);
  if (f.status === "unresolved") q = q.in("status", ["open", "in_progress"]);
  else if (f.status === "done") q = q.in("status", ["resolved", "closed"]);
  else if (f.status) q = q.eq("status", f.status);
  if (f.type) q = q.eq("type", f.type);
  if (f.supplier) q = q.eq("supplier_id", f.supplier);
  if (f.assignee === "me") q = q.eq("assigned_to", ctx.user.id);
  else if (f.assignee === "unassigned") q = q.is("assigned_to", null);
  else if (f.assignee) q = q.eq("assigned_to", f.assignee);
  const { fromIso, toIso } = dayRange(f.from, f.to);
  if (fromIso) q = q.gte("occurred_at", fromIso);
  if (toIso) q = q.lt("occurred_at", toIso);

  const term = f.q ? sanitizeSearch(f.q) : "";
  if (term) {
    const num = term.match(/^(?:ex-?)?(\d{1,9})$/i);
    const { data: sup } = await ctx.supabase
      .from("suppliers")
      .select("id")
      .eq("org_id", ctx.org.orgId)
      .ilike("name", `%${term}%`)
      .limit(50);
    const ors = ["po_number", "shipment_ref", "sku", "item_description", "description"].map((c) => `${c}.ilike.*${term}*`);
    if (num) ors.push(`number.eq.${num[1]}`);
    if (sup?.length) ors.push(`supplier_id.in.(${sup.map((s) => s.id).join(",")})`);
    q = q.or(ors.join(","));
  }
  return { query: q.order("occurred_at", { ascending: false }), facilityId };
}
