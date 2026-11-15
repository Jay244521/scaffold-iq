import Link from "next/link";
import type { Metadata } from "next";
import { Plus, Search } from "lucide-react";
import { LocalTime } from "@/components/client";
import { EmptyState, LinkButton, PageHeader, StatusBadge, TypeBadge, buttonClass } from "@/components/ui";
import { getMembers, requireAppContext } from "@/lib/context";
import { logError } from "@/lib/errors";
import {
  EXCEPTION_LABELS,
  EXCEPTION_TYPES,
  STATUS_LABELS,
  STATUSES,
  formatQty,
  incidentRef,
  variance,
  type ExceptionType,
  type IncidentStatus,
} from "@/lib/labels";
import { can } from "@/lib/permissions";
import { incidentFilterSchema, sanitizeSearch, type IncidentFilters } from "@/lib/validation";

export const metadata: Metadata = { title: "Incidents" };

const PAGE_SIZE = 25;

type Row = {
  id: string;
  number: number;
  type: ExceptionType;
  status: IncidentStatus;
  occurred_at: string;
  po_number: string | null;
  shipment_ref: string | null;
  sku: string | null;
  expected_qty: number | null;
  received_qty: number | null;
  assigned_to: string | null;
  suppliers: { name: string } | null;
  facilities: { name: string } | null;
};

export default async function IncidentsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireAppContext();
  const raw = Object.fromEntries(Object.entries(await searchParams).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v || undefined]));
  const f: IncidentFilters = incidentFilterSchema.parse(raw);
  const page = f.page ?? 1;
  const facilityId = f.facility && ctx.facilities.some((x) => x.id === f.facility) ? f.facility : ctx.facility?.id;

  let q = ctx.supabase
    .from("incidents")
    .select(
      "id, number, type, status, occurred_at, po_number, shipment_ref, sku, expected_qty, received_qty, assigned_to, suppliers(name), facilities(name)",
      { count: "exact" },
    )
    .eq("org_id", ctx.org.orgId);

  if (facilityId) q = q.eq("facility_id", facilityId);
  if (f.status === "unresolved") q = q.in("status", ["open", "in_progress"]);
  else if (f.status) q = q.eq("status", f.status);
  if (f.type) q = q.eq("type", f.type);
  if (f.supplier) q = q.eq("supplier_id", f.supplier);
  if (f.assignee === "me") q = q.eq("assigned_to", ctx.user.id);
  else if (f.assignee === "unassigned") q = q.is("assigned_to", null);
  else if (f.assignee) q = q.eq("assigned_to", f.assignee);
  if (f.from) q = q.gte("occurred_at", `${f.from}T00:00:00Z`);
  if (f.to) q = q.lt("occurred_at", new Date(Date.parse(`${f.to}T00:00:00Z`) + 86_400_000).toISOString());

  const term = f.q ? sanitizeSearch(f.q) : "";
  if (term) {
    const num = term.match(/^(?:ex-?)?(\d{1,9})$/i);
    const { data: sup } = await ctx.supabase.from("suppliers").select("id").eq("org_id", ctx.org.orgId).ilike("name", `%${term}%`).limit(50);
    const ors = ["po_number", "shipment_ref", "sku", "item_description", "description"].map((c) => `${c}.ilike.*${term}*`);
    if (num) ors.push(`number.eq.${num[1]}`);
    if (sup?.length) ors.push(`supplier_id.in.(${sup.map((s) => s.id).join(",")})`);
    q = q.or(ors.join(","));
  }

  const { data, count, error } = await q.order("occurred_at", { ascending: false }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (error) logError("list incidents", error);
  const rows = (data ?? []) as unknown as Row[];
  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const [members, { data: suppliers }] = await Promise.all([
    getMembers(ctx.org.orgId),
    ctx.supabase.from("suppliers").select("id, name").eq("org_id", ctx.org.orgId).order("name").limit(500),
  ]);
  const memberName = new Map(members.map((m) => [m.userId, m.name]));
  const filtered = Object.entries(f).some(([k, v]) => v && k !== "page");

  const pageHref = (p: number) => {
    const sp = new URLSearchParams(Object.entries({ ...raw, page: String(p) }).filter(([, v]) => v) as [string, string][]);
    return `/incidents?${sp}`;
  };

  return (
    <>
      <PageHeader
        title="Incidents"
        description={`${total.toLocaleString()} receiving exception${total === 1 ? "" : "s"}${facilityId ? ` at ${ctx.facilities.find((x) => x.id === facilityId)?.name}` : ""}`}
        actions={
          can.createIncident(ctx.org.role) ? (
            <LinkButton href="/incidents/new">
              <Plus className="h-4 w-4" aria-hidden /> Report exception
            </LinkButton>
          ) : undefined
        }
      />

      <form method="get" className="card mb-4 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4" role="search" aria-label="Filter incidents">
        <div className="sm:col-span-2">
          <label htmlFor="q" className="label">
            Search
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" aria-hidden />
            <input id="q" name="q" defaultValue={f.q} placeholder="EX number, PO, shipment, SKU, supplier, description" className="input pl-9" maxLength={100} />
          </div>
        </div>
        <FilterSelect name="status" label="Status" value={f.status} options={[["unresolved", "Unresolved (open + in progress)"], ...STATUSES.map((s) => [s, STATUS_LABELS[s]] as [string, string])]} />
        <FilterSelect name="type" label="Category" value={f.type} options={EXCEPTION_TYPES.map((t) => [t, EXCEPTION_LABELS[t]])} />
        <FilterSelect name="facility" label="Facility" value={facilityId} options={ctx.facilities.map((x) => [x.id, x.name])} />
        <FilterSelect name="supplier" label="Supplier" value={f.supplier} options={(suppliers ?? []).map((s) => [s.id as string, s.name as string])} />
        <FilterSelect
          name="assignee"
          label="Responsible"
          value={f.assignee}
          options={[["me", "Assigned to me"], ["unassigned", "Unassigned"], ...members.map((m) => [m.userId, m.name] as [string, string])]}
        />
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor="from" className="label">
              From
            </label>
            <input id="from" name="from" type="date" defaultValue={f.from} className="input" />
          </div>
          <div>
            <label htmlFor="to" className="label">
              To
            </label>
            <input id="to" name="to" type="date" defaultValue={f.to} className="input" />
          </div>
        </div>
        <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-4 lg:justify-end">
          {filtered && (
            <Link href="/incidents" className={buttonClass("ghost")}>
              Clear filters
            </Link>
          )}
          <button className={buttonClass("primary")}>Apply filters</button>
        </div>
      </form>

      {rows.length === 0 ? (
        <EmptyState
          title={filtered ? "No incidents match these filters" : "No incidents yet"}
          description={filtered ? "Try widening the date range or clearing filters." : "Reported receiving exceptions will appear here."}
        />
      ) : (
        <>
          {/* Desktop table */}
          <div className="card hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Ref</th>
                  <th className="px-3 py-2.5 font-medium">Category</th>
                  <th className="px-3 py-2.5 font-medium">Supplier / PO</th>
                  {!facilityId && <th className="px-3 py-2.5 font-medium">Facility</th>}
                  <th className="px-3 py-2.5 text-right font-medium">Variance</th>
                  <th className="px-3 py-2.5 font-medium">Responsible</th>
                  <th className="px-3 py-2.5 font-medium">Occurred</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => {
                  const d = variance(r.expected_qty, r.received_qty);
                  return (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5">
                        <Link href={`/incidents/${r.id}`} className="font-mono font-medium text-brand-700 hover:underline">
                          {incidentRef(r.number)}
                        </Link>
                      </td>
                      <td className="px-3 py-2.5">
                        <TypeBadge type={r.type} />
                      </td>
                      <td className="max-w-56 px-3 py-2.5">
                        <p className="truncate text-slate-900">{r.suppliers?.name ?? "—"}</p>
                        <p className="truncate text-xs text-slate-500">{[r.po_number, r.shipment_ref, r.sku].filter(Boolean).join(" · ") || "—"}</p>
                      </td>
                      {!facilityId && <td className="px-3 py-2.5 text-slate-700">{r.facilities?.name}</td>}
                      <td className="px-3 py-2.5 text-right tabular-nums">{d === null ? "—" : `${d > 0 ? "+" : ""}${formatQty(d)}`}</td>
                      <td className="px-3 py-2.5 text-slate-700">{r.assigned_to ? (memberName.get(r.assigned_to) ?? "Former member") : <span className="text-slate-400">Unassigned</span>}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-slate-700">
                        <LocalTime value={r.occurred_at} />
                      </td>
                      <td className="px-4 py-2.5">
                        <StatusBadge status={r.status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {/* Mobile cards */}
          <ul className="space-y-2 md:hidden">
            {rows.map((r) => (
              <li key={r.id}>
                <Link href={`/incidents/${r.id}`} className="card block p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-sm font-medium text-brand-700">{incidentRef(r.number)}</span>
                    <StatusBadge status={r.status} />
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <TypeBadge type={r.type} />
                    <span className="text-sm text-slate-900">{r.suppliers?.name ?? "No supplier"}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {[r.po_number, r.facilities?.name].filter(Boolean).join(" · ")} · <LocalTime value={r.occurred_at} mode="relative" />
                  </p>
                </Link>
              </li>
            ))}
          </ul>
          {pages > 1 && (
            <nav className="mt-4 flex items-center justify-between text-sm" aria-label="Pagination">
              <span className="text-slate-600">
                Page {page} of {pages}
              </span>
              <div className="flex gap-2">
                {page > 1 && (
                  <Link href={pageHref(page - 1)} className={buttonClass("secondary", "sm")}>
                    Previous
                  </Link>
                )}
                {page < pages && (
                  <Link href={pageHref(page + 1)} className={buttonClass("secondary", "sm")}>
                    Next
                  </Link>
                )}
              </div>
            </nav>
          )}
        </>
      )}
      <p className="mt-3 text-xs text-slate-500">Date filters use UTC days.</p>
    </>
  );
}

function FilterSelect({ name, label, value, options }: { name: string; label: string; value?: string; options: [string, string][] }) {
  return (
    <div>
      <label htmlFor={name} className="label">
        {label}
      </label>
      <select id={name} name={name} defaultValue={value ?? ""} className="input">
        <option value="">All</option>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </div>
  );
}
