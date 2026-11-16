import Link from "next/link";
import type { Metadata } from "next";
import { Search, Upload } from "lucide-react";
import { LocalTime } from "@/components/client";
import { Card, EmptyState, LinkButton, PageHeader, buttonClass, cx } from "@/components/ui";
import { getMembers, requireAppContext } from "@/lib/context";
import { formatQty } from "@/lib/labels";
import { can } from "@/lib/permissions";
import { sanitizeSearch } from "@/lib/validation";

export const metadata: Metadata = { title: "Inventory" };

const PAGE = 50;

type ImportRow = {
  id: string;
  file_name: string;
  source: string;
  status: string;
  total_rows: number;
  discrepancy_rows: number;
  new_rows: number;
  invalid_rows: number;
  applied_rows: number;
  created_at: string;
  created_by: string | null;
  facility_id: string;
};
type Item = { id: string; sku: string; location: string; description: string | null; on_hand: number; updated_at: string; facility_id: string };
type Adjustment = { id: number; sku: string; location: string; old_qty: number | null; new_qty: number; approved_by: string | null; created_at: string; import_id: string | null };

export default async function InventoryPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const ctx = await requireAppContext();
  const sp = await searchParams;
  const q = sp.q ? sanitizeSearch(sp.q) : "";
  const page = Math.max(1, Number(sp.page) || 1);
  const facilityId = ctx.facility?.id;

  let importsQ = ctx.supabase
    .from("inventory_imports")
    .select("id, file_name, source, status, total_rows, discrepancy_rows, new_rows, invalid_rows, applied_rows, created_at, created_by, facility_id")
    .eq("org_id", ctx.org.orgId)
    .order("created_at", { ascending: false })
    .limit(10);
  let itemsQ = ctx.supabase
    .from("inventory_items")
    .select("id, sku, location, description, on_hand, updated_at, facility_id", { count: "exact" })
    .eq("org_id", ctx.org.orgId)
    .order("sku")
    .order("location");
  let adjQ = ctx.supabase
    .from("inventory_adjustments")
    .select("id, sku, location, old_qty, new_qty, approved_by, created_at, import_id")
    .eq("org_id", ctx.org.orgId)
    .order("created_at", { ascending: false })
    .limit(10);
  if (facilityId) {
    importsQ = importsQ.eq("facility_id", facilityId);
    itemsQ = itemsQ.eq("facility_id", facilityId);
    adjQ = adjQ.eq("facility_id", facilityId);
  }
  if (q) itemsQ = itemsQ.or(`sku.ilike.*${q}*,description.ilike.*${q}*,location.ilike.*${q}*`);

  const [{ data: imports }, { data: items, count }, { data: adjustments }, members] = await Promise.all([
    importsQ,
    itemsQ.range((page - 1) * PAGE, page * PAGE - 1),
    adjQ,
    getMembers(ctx.org.orgId),
  ]);
  const nameOf = (u: string | null) => (u ? (members.find((m) => m.userId === u)?.name ?? "Former member") : "—");
  const facName = (id: string) => ctx.facilities.find((f) => f.id === id)?.name ?? "";
  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE));
  const pendingCount = ((imports ?? []) as ImportRow[]).filter((i) => i.status === "pending_review").length;

  return (
    <>
      <PageHeader
        title="Inventory"
        description={`Compare counts and system exports with your records${ctx.facility ? ` at ${ctx.facility.name}` : ""}. Changes are only made after a manager approves them.`}
        actions={
          can.importInventory(ctx.org.role) ? (
            <LinkButton href="/inventory/import">
              <Upload className="h-4 w-4" aria-hidden /> Import CSV
            </LinkButton>
          ) : undefined
        }
      />

      <Card title={`Imports${pendingCount ? ` · ${pendingCount} awaiting review` : ""}`} className="mb-6">
        {(imports ?? []).length === 0 ? (
          <EmptyState
            title="No inventory files yet"
            description="Upload a physical count or an export from your WMS/ERP to find discrepancies."
            action={can.importInventory(ctx.org.role) ? <LinkButton href="/inventory/import">Import your first file</LinkButton> : undefined}
          />
        ) : (
          <ul className="-mx-4 -my-2 divide-y divide-slate-100">
            {((imports ?? []) as ImportRow[]).map((i) => (
              <li key={i.id}>
                <Link href={`/inventory/imports/${i.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 hover:bg-slate-50">
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-900">{i.file_name}</span>
                  <span className="text-xs text-slate-500">
                    {i.source === "count" ? "Count" : "System export"} · {facName(i.facility_id)} · {i.total_rows} rows · {i.discrepancy_rows} discrepancies · {i.new_rows} new
                    {i.invalid_rows ? ` · ${i.invalid_rows} invalid` : ""} · {nameOf(i.created_by)} <LocalTime value={i.created_at} mode="relative" />
                  </span>
                  <span
                    className={cx(
                      "rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
                      i.status === "pending_review" ? "bg-amber-50 text-amber-900 ring-amber-200" : i.status === "applied" ? "bg-emerald-50 text-emerald-800 ring-emerald-200" : "bg-slate-100 text-slate-700 ring-slate-200",
                    )}
                  >
                    {i.status === "pending_review" ? "Awaiting review" : i.status === "applied" ? `Applied (${i.applied_rows})` : "Discarded"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card title={`Inventory records (${(count ?? 0).toLocaleString()})`} className="lg:col-span-2">
          <form method="get" className="mb-3 flex gap-2" role="search">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" aria-hidden />
              <label htmlFor="q" className="sr-only">Search inventory</label>
              <input id="q" name="q" defaultValue={sp.q} placeholder="SKU, description or location" className="input pl-9" maxLength={100} />
            </div>
            <button className={buttonClass("secondary")}>Search</button>
          </form>
          {(items ?? []).length === 0 ? (
            <p className="text-sm text-slate-500">{q ? "No records match." : "No inventory records yet. Approved rows from an import create them."}</p>
          ) : (
            <div className="-mx-4 overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 pb-2 font-medium">SKU</th>
                    <th className="px-2 pb-2 font-medium">Location</th>
                    <th className="px-2 pb-2 font-medium">Description</th>
                    {!facilityId && <th className="px-2 pb-2 font-medium">Facility</th>}
                    <th className="px-2 pb-2 text-right font-medium">On hand</th>
                    <th className="px-4 pb-2 font-medium">Updated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {((items ?? []) as Item[]).map((it) => (
                    <tr key={it.id}>
                      <td className="px-4 py-1.5 font-mono text-xs text-slate-900">{it.sku}</td>
                      <td className="px-2 py-1.5 text-slate-700">{it.location || "—"}</td>
                      <td className="max-w-56 truncate px-2 py-1.5 text-slate-700">{it.description ?? "—"}</td>
                      {!facilityId && <td className="px-2 py-1.5 text-slate-700">{facName(it.facility_id)}</td>}
                      <td className="px-2 py-1.5 text-right tabular-nums">{formatQty(it.on_hand)}</td>
                      <td className="whitespace-nowrap px-4 py-1.5 text-xs text-slate-500"><LocalTime value={it.updated_at} mode="date" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {pages > 1 && (
            <nav className="mt-3 flex items-center justify-between text-sm" aria-label="Pagination">
              <span className="text-slate-600">Page {page} of {pages}</span>
              <div className="flex gap-2">
                {page > 1 && <Link href={`/inventory?${new URLSearchParams({ ...(sp.q ? { q: sp.q } : {}), page: String(page - 1) })}`} className={buttonClass("secondary", "sm")}>Previous</Link>}
                {page < pages && <Link href={`/inventory?${new URLSearchParams({ ...(sp.q ? { q: sp.q } : {}), page: String(page + 1) })}`} className={buttonClass("secondary", "sm")}>Next</Link>}
              </div>
            </nav>
          )}
        </Card>

        <Card title="Recent approved changes">
          {(adjustments ?? []).length === 0 ? (
            <p className="text-sm text-slate-500">No changes yet. Every approved correction is listed here with who approved it.</p>
          ) : (
            <ul className="space-y-3 text-sm">
              {((adjustments ?? []) as Adjustment[]).map((a) => (
                <li key={a.id}>
                  <p className="font-mono text-xs text-slate-900">{a.sku}{a.location && <span className="text-slate-500"> · {a.location}</span>}</p>
                  <p className="text-slate-700">
                    {a.old_qty === null ? "Created with" : `${formatQty(a.old_qty)} →`} <strong className="tabular-nums">{formatQty(a.new_qty)}</strong>
                  </p>
                  <p className="text-xs text-slate-500">
                    Approved by {nameOf(a.approved_by)} · <LocalTime value={a.created_at} mode="relative" />
                    {a.import_id && <> · <Link href={`/inventory/imports/${a.import_id}`} className="text-brand-600 hover:underline">import</Link></>}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
