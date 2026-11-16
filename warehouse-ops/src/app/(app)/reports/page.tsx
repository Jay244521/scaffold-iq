import Link from "next/link";
import type { Metadata } from "next";
import { Download } from "lucide-react";
import { LocalTime } from "@/components/client";
import { Card, EmptyState, PageHeader, StatusBadge, TypeBadge, buttonClass, cx } from "@/components/ui";
import { getMembers, requireAppContext } from "@/lib/context";
import { logError } from "@/lib/errors";
import { dayRange } from "@/lib/incident-query";
import { EXCEPTION_LABELS, incidentRef, type ExceptionType, type IncidentStatus } from "@/lib/labels";
import { incidentFilterSchema } from "@/lib/validation";

export const metadata: Metadata = { title: "Reports" };

type SupplierRow = {
  id: string | null;
  name: string;
  total: number;
  unresolved: number;
  shortage: number;
  overage: number;
  damaged: number;
  wrong_item: number;
  other: number;
  unit_variance: number | null;
  avg_hours: number | null;
};
type TypeRow = { type: ExceptionType; total: number; unresolved: number; avg_hours: number | null; median_hours: number | null };
type Report = {
  total: number;
  unresolved: number;
  resolved: number;
  avg_hours: number | null;
  median_hours: number | null;
  by_supplier: SupplierRow[];
  by_type: TypeRow[];
  aging: { d0_2: number; d3_7: number; d8_30: number; d31_plus: number };
};
type OpenRow = {
  id: string;
  number: number;
  type: ExceptionType;
  status: IncidentStatus;
  created_at: string;
  assigned_to: string | null;
  suppliers: { name: string } | null;
};

const iso = (d: Date) => d.toISOString().slice(0, 10);
const PRESETS = [
  { label: "Last 30 days", days: 30 },
  { label: "Last 90 days", days: 90 },
  { label: "Last 12 months", days: 365 },
];

function hours(h: number | null | undefined) {
  if (h === null || h === undefined) return "—";
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} min`;
  if (h < 48) return `${Number(h).toFixed(1)} hr`;
  return `${(h / 24).toFixed(1)} days`;
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const ctx = await requireAppContext();
  const sp = await searchParams;
  const parsed = incidentFilterSchema.parse({ from: sp.from, to: sp.to, facility: sp.facility });
  const today = new Date();
  const from = parsed.from ?? iso(new Date(today.getTime() - 89 * 86_400_000));
  const to = parsed.to ?? iso(today);
  const facilityId = parsed.facility && ctx.facilities.some((f) => f.id === parsed.facility) ? parsed.facility : ctx.facility?.id;
  const { fromIso, toIso } = dayRange(from, to);

  const [{ data, error }, openRes, members] = await Promise.all([
    ctx.supabase.rpc("incident_report", { p_org: ctx.org.orgId, p_facility: facilityId ?? null, p_from: fromIso, p_to: toIso }),
    (() => {
      let q = ctx.supabase
        .from("incidents")
        .select("id, number, type, status, created_at, assigned_to, suppliers(name)")
        .eq("org_id", ctx.org.orgId)
        .in("status", ["open", "in_progress"])
        .gte("occurred_at", fromIso!)
        .lt("occurred_at", toIso!)
        .order("created_at", { ascending: true })
        .limit(25);
      if (facilityId) q = q.eq("facility_id", facilityId);
      return q;
    })(),
    getMembers(ctx.org.orgId),
  ]);
  if (error) logError("incident_report", error);
  const r = (data as Report | null) ?? null;
  const oldest = (openRes.data ?? []) as unknown as OpenRow[];
  const nameOf = (id: string | null) => (id ? (members.find((m) => m.userId === id)?.name ?? "Former member") : "Unassigned");
  const params = new URLSearchParams({ from, to, ...(facilityId ? { facility: facilityId } : {}) });
  const listHref = (extra: Record<string, string>) => `/incidents?${new URLSearchParams({ ...Object.fromEntries(params), ...extra })}`;
  const agingMax = r ? Math.max(1, r.aging.d0_2, r.aging.d3_7, r.aging.d8_30, r.aging.d31_plus) : 1;

  return (
    <>
      <PageHeader
        title="Reports"
        description={`Receiving exceptions that occurred ${from} to ${to}${facilityId ? ` at ${ctx.facilities.find((f) => f.id === facilityId)?.name}` : " across all facilities"}.`}
        actions={
          <a href={`/incidents/export?${params}`} className={buttonClass("primary")}>
            <Download className="h-4 w-4" aria-hidden /> Export CSV
          </a>
        }
      />

      <form method="get" className="card mb-6 flex flex-wrap items-end gap-3 p-4" aria-label="Report filters">
        <div>
          <label htmlFor="from" className="label">From</label>
          <input id="from" name="from" type="date" defaultValue={from} className="input" required />
        </div>
        <div>
          <label htmlFor="to" className="label">To</label>
          <input id="to" name="to" type="date" defaultValue={to} className="input" required />
        </div>
        <div>
          <label htmlFor="facility" className="label">Facility</label>
          <select id="facility" name="facility" defaultValue={facilityId ?? ""} className="input">
            <option value="">All facilities</option>
            {ctx.facilities.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
        </div>
        <button className={buttonClass("secondary")}>Apply</button>
        <div className="flex flex-wrap gap-2 text-sm">
          {PRESETS.map((p) => (
            <Link
              key={p.days}
              href={`/reports?${new URLSearchParams({ from: iso(new Date(today.getTime() - (p.days - 1) * 86_400_000)), to: iso(today), ...(facilityId ? { facility: facilityId } : {}) })}`}
              className="rounded-md px-2 py-1 text-brand-700 hover:bg-brand-50"
            >
              {p.label}
            </Link>
          ))}
        </div>
        <p className="w-full text-xs text-slate-500">Dates are UTC days. The CSV export uses the same filters.</p>
      </form>

      {!r || r.total === 0 ? (
        <EmptyState title="No exceptions in this period" description="Try a wider date range or another facility." />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            {[
              { label: "Exceptions", value: r.total.toLocaleString(), href: listHref({}) },
              { label: "Unresolved", value: r.unresolved.toLocaleString(), href: listHref({ status: "unresolved" }) },
              { label: "Resolved", value: r.resolved.toLocaleString(), href: listHref({ status: "done" }) },
              { label: "Avg. time to resolve", value: hours(r.avg_hours) },
              { label: "Median time to resolve", value: hours(r.median_hours) },
            ].map((t) => {
              const body = (
                <>
                  <p className="text-sm text-slate-600">{t.label}</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{t.value}</p>
                </>
              );
              return t.href ? (
                <Link key={t.label} href={t.href} className="card px-4 py-3 hover:border-slate-300">{body}</Link>
              ) : (
                <div key={t.label} className="card px-4 py-3">{body}</div>
              );
            })}
          </div>

          <Card title="Exceptions by supplier" className="mt-6">
            <div className="-mx-4 overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 pb-2 font-medium">Supplier</th>
                    <th className="px-2 pb-2 text-right font-medium">Total</th>
                    <th className="px-2 pb-2 text-right font-medium">Unresolved</th>
                    <th className="px-2 pb-2 text-right font-medium">Short</th>
                    <th className="px-2 pb-2 text-right font-medium">Over</th>
                    <th className="px-2 pb-2 text-right font-medium">Damaged</th>
                    <th className="px-2 pb-2 text-right font-medium">Wrong item</th>
                    <th className="px-2 pb-2 text-right font-medium">Other</th>
                    <th className="px-2 pb-2 text-right font-medium">Unit variance</th>
                    <th className="px-4 pb-2 text-right font-medium">Avg. resolve</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 tabular-nums">
                  {r.by_supplier.map((s) => (
                    <tr key={s.id ?? "none"}>
                      <td className="px-4 py-2 font-medium text-slate-900">
                        {s.id ? <Link href={listHref({ supplier: s.id })} className="hover:underline">{s.name}</Link> : <span className="text-slate-500">{s.name}</span>}
                      </td>
                      <td className="px-2 py-2 text-right">{s.total}</td>
                      <td className="px-2 py-2 text-right">{s.unresolved}</td>
                      <td className="px-2 py-2 text-right">{s.shortage || "·"}</td>
                      <td className="px-2 py-2 text-right">{s.overage || "·"}</td>
                      <td className="px-2 py-2 text-right">{s.damaged || "·"}</td>
                      <td className="px-2 py-2 text-right">{s.wrong_item || "·"}</td>
                      <td className="px-2 py-2 text-right">{s.other || "·"}</td>
                      <td className="px-2 py-2 text-right">{Number(s.unit_variance ?? 0).toLocaleString()}</td>
                      <td className="px-4 py-2 text-right">{hours(s.avg_hours)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card title="Exceptions by category">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="pb-2 font-medium">Category</th>
                    <th className="pb-2 text-right font-medium">Total</th>
                    <th className="pb-2 text-right font-medium">Unresolved</th>
                    <th className="pb-2 text-right font-medium">Avg.</th>
                    <th className="pb-2 text-right font-medium">Median</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 tabular-nums">
                  {r.by_type.map((t) => (
                    <tr key={t.type}>
                      <td className="py-2"><Link href={listHref({ type: t.type })} className="hover:underline">{EXCEPTION_LABELS[t.type]}</Link></td>
                      <td className="py-2 text-right">{t.total}</td>
                      <td className="py-2 text-right">{t.unresolved}</td>
                      <td className="py-2 text-right">{hours(t.avg_hours)}</td>
                      <td className="py-2 text-right">{hours(t.median_hours)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-3 text-xs text-slate-500">Resolution time is measured from when the exception was reported to when it was resolved.</p>
            </Card>

            <Card title="Unresolved exceptions by age">
              {r.unresolved === 0 ? (
                <p className="text-sm text-slate-500">Nothing unresolved in this period.</p>
              ) : (
                <ul className="space-y-3">
                  {[
                    ["0–2 days", r.aging.d0_2],
                    ["3–7 days", r.aging.d3_7],
                    ["8–30 days", r.aging.d8_30],
                    ["Over 30 days", r.aging.d31_plus],
                  ].map(([label, v]) => (
                    <li key={label as string} title={`${label}: ${v}`}>
                      <div className="mb-1 flex justify-between text-sm">
                        <span className="text-slate-700">{label}</span>
                        <span className="font-medium tabular-nums text-slate-900">{v}</span>
                      </div>
                      <div className="h-2 rounded bg-slate-100">
                        <div className={cx("h-2 rounded bg-brand-500")} style={{ width: `${(Number(v) / agingMax) * 100}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <Card title="Oldest unresolved exceptions" className="mt-6" actions={<Link href={listHref({ status: "unresolved" })} className="text-sm font-medium text-brand-600 hover:underline">View all</Link>}>
            {oldest.length === 0 ? (
              <p className="text-sm text-slate-500">Nothing unresolved in this period.</p>
            ) : (
              <ul className="-mx-4 -my-2 divide-y divide-slate-100">
                {oldest.map((o) => (
                  <li key={o.id}>
                    <Link href={`/incidents/${o.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 hover:bg-slate-50">
                      <span className="w-14 font-mono text-sm font-medium text-slate-900">{incidentRef(o.number)}</span>
                      <TypeBadge type={o.type} />
                      <span className="order-last w-full truncate text-sm text-slate-700 sm:order-none sm:w-auto sm:flex-1">
                        {o.suppliers?.name ?? "No supplier"} · {nameOf(o.assigned_to)}
                      </span>
                      <span className="ml-auto text-xs text-slate-500 sm:ml-0">open since <LocalTime value={o.created_at} mode="date" /></span>
                      <StatusBadge status={o.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </>
  );
}
