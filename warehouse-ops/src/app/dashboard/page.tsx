import Link from "next/link";
import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { LocalTime } from "@/components/client";
import { PatternsCard, type Patterns } from "@/components/PatternsCard";
import { Alert, Card, EmptyState, LinkButton, PageHeader, StatusBadge, TypeBadge, cx } from "@/components/ui";
import { requireAppContext } from "@/lib/context";
import { logError } from "@/lib/errors";
import { EXCEPTION_LABELS, EXCEPTION_TYPES, incidentRef, type ExceptionType, type IncidentStatus } from "@/lib/labels";
import { can } from "@/lib/permissions";

export const metadata: Metadata = { title: "Dashboard" };

const RANGES = { "7": "Last 7 days", "30": "Last 30 days", "90": "Last 90 days", all: "All time" } as const;
type RangeKey = keyof typeof RANGES;

type Summary = {
  total: number;
  by_status: Partial<Record<IncidentStatus, number>>;
  by_type: Partial<Record<ExceptionType, number>>;
  by_supplier: { id: string; name: string; total: number; unresolved: number; top_type: ExceptionType; unit_variance: number | null }[];
  avg_resolution_hours: number | null;
};

type RecentRow = {
  id: string;
  number: number;
  type: ExceptionType;
  status: IncidentStatus;
  occurred_at: string;
  po_number: string | null;
  suppliers: { name: string } | null;
  facilities: { name: string } | null;
};

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ range?: string; welcome?: string; joined?: string }> }) {
  const ctx = await requireAppContext();
  const sp = await searchParams;
  const range: RangeKey = sp.range && sp.range in RANGES ? (sp.range as RangeKey) : "30";
  const from = range === "all" ? null : new Date(Date.now() - Number(range) * 86_400_000).toISOString();

  const [{ data: summaryData, error: summaryError }, { data: recentData }, { data: patternData }, { data: mineData }] = await Promise.all([
    ctx.supabase.rpc("incident_summary", { p_org: ctx.org.orgId, p_facility: ctx.facility?.id ?? null, p_from: from, p_to: null }),
    (() => {
      let q = ctx.supabase
        .from("incidents")
        .select("id, number, type, status, occurred_at, po_number, suppliers(name), facilities(name)")
        .eq("org_id", ctx.org.orgId)
        .order("occurred_at", { ascending: false })
        .limit(8);
      if (ctx.facility) q = q.eq("facility_id", ctx.facility.id);
      return q;
    })(),
    ctx.supabase.rpc("exception_patterns", { p_org: ctx.org.orgId, p_facility: ctx.facility?.id ?? null }),
    ctx.supabase
      .from("incidents")
      .select("id, number, type, status, occurred_at, po_number, suppliers(name), facilities(name)")
      .eq("org_id", ctx.org.orgId)
      .eq("assigned_to", ctx.user.id)
      .in("status", ["open", "in_progress"])
      .order("occurred_at", { ascending: true })
      .limit(5),
  ]);
  const mine = (mineData ?? []) as unknown as RecentRow[];
  if (summaryError) logError("incident_summary", summaryError);

  const s: Summary = (summaryData as Summary) ?? { total: 0, by_status: {}, by_type: {}, by_supplier: [], avg_resolution_hours: null };
  const recent = (recentData ?? []) as unknown as RecentRow[];
  const n = (k: IncidentStatus) => s.by_status[k] ?? 0;
  const maxType = Math.max(1, ...EXCEPTION_TYPES.map((t) => s.by_type[t] ?? 0));
  const scope = ctx.facility ? ctx.facility.name : "all facilities";
  const noFacilities = ctx.facilities.length === 0;

  const tiles = [
    { label: "Total exceptions", value: s.total, href: "/incidents" },
    { label: "Open", value: n("open"), href: "/incidents?status=open", accent: "border-l-red-500" },
    { label: "In progress", value: n("in_progress"), href: "/incidents?status=in_progress", accent: "border-l-amber-500" },
    { label: "Resolved", value: n("resolved") + n("closed"), href: "/incidents?status=done", accent: "border-l-emerald-500" },
  ];

  return (
    <>
      <PageHeader
        title="Operations dashboard"
        description={`Receiving exceptions for ${scope} · ${RANGES[range].toLowerCase()}`}
        actions={
          <>
            <nav aria-label="Date range" className="flex rounded-md border border-slate-300 bg-white p-0.5 text-sm">
              {(Object.keys(RANGES) as RangeKey[]).map((k) => (
                <Link
                  key={k}
                  href={`/dashboard?range=${k}`}
                  aria-current={k === range ? "true" : undefined}
                  className={cx("rounded px-2.5 py-1", k === range ? "bg-brand-600 text-white" : "text-slate-700 hover:bg-slate-100")}
                >
                  {k === "all" ? "All" : `${k}d`}
                </Link>
              ))}
            </nav>
            {can.createIncident(ctx.org.role) && (
              <LinkButton href="/incidents/new">
                <Plus className="h-4 w-4" aria-hidden /> Report exception
              </LinkButton>
            )}
          </>
        }
      />

      <div className="mb-6 space-y-3">
        {sp.welcome && <Alert tone="success">Your workspace is ready. Next: add your facilities and invite your team from Settings.</Alert>}
        {sp.joined && <Alert tone="success">You've joined {ctx.org.orgName}.</Alert>}
        {noFacilities && (
          <Alert tone="warning">
            Add a facility before reporting exceptions.{" "}
            {can.manageFacilities(ctx.org.role) ? (
              <Link href="/settings/facilities" className="font-medium underline">
                Add a facility
              </Link>
            ) : (
              "Ask a manager or admin to add one."
            )}
          </Alert>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {tiles.map((t) => (
          <Link key={t.label} href={t.href} className={cx("card border-l-4 px-4 py-3 hover:border-slate-300", t.accent ?? "border-l-brand-600")}>
            <p className="text-sm text-slate-600">{t.label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900 sm:text-3xl">{t.value.toLocaleString()}</p>
          </Link>
        ))}
        <div className="card col-span-2 border-l-4 border-l-slate-400 px-4 py-3 lg:col-span-1">
          <p className="text-sm text-slate-600">Avg. time to resolve</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900 sm:text-3xl">
            {s.avg_resolution_hours == null ? "—" : formatHours(s.avg_resolution_hours)}
          </p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-5">
        <Card title="Exceptions by category" className="lg:col-span-2">
          {s.total === 0 ? (
            <p className="text-sm text-slate-500">No exceptions in this period.</p>
          ) : (
            <ul className="space-y-3">
              {EXCEPTION_TYPES.map((t) => {
                const v = s.by_type[t] ?? 0;
                return (
                  <li key={t}>
                    <Link href={`/incidents?type=${t}`} className="group block" title={`${EXCEPTION_LABELS[t]}: ${v}`}>
                      <div className="mb-1 flex justify-between text-sm">
                        <span className="text-slate-700 group-hover:underline">{EXCEPTION_LABELS[t]}</span>
                        <span className="font-medium tabular-nums text-slate-900">
                          {v} <span className="font-normal text-slate-500">({Math.round((v / s.total) * 100)}%)</span>
                        </span>
                      </div>
                      <div className="h-2 rounded bg-slate-100">
                        <div className="h-2 rounded bg-brand-500" style={{ width: `${(v / maxType) * 100}%` }} />
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card title="Supplier patterns" className="lg:col-span-3">
          {s.by_supplier.length === 0 ? (
            <p className="text-sm text-slate-500">No supplier-linked exceptions in this period. Add the supplier when reporting an exception to see patterns here.</p>
          ) : (
            <div className="-mx-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 pb-2 font-medium">Supplier</th>
                    <th className="px-2 pb-2 text-right font-medium">Exceptions</th>
                    <th className="px-2 pb-2 text-right font-medium">Unresolved</th>
                    <th className="px-2 pb-2 font-medium">Most common</th>
                    <th className="px-4 pb-2 text-right font-medium">Unit variance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {s.by_supplier.map((r) => (
                    <tr key={r.id}>
                      <td className="px-4 py-2">
                        <Link href={`/incidents?supplier=${r.id}`} className="font-medium text-slate-900 hover:underline">
                          {r.name}
                        </Link>
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">{r.total}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{r.unresolved}</td>
                      <td className="px-2 py-2 text-slate-700">{EXCEPTION_LABELS[r.top_type]}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{Number(r.unit_variance ?? 0).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {mine.length > 0 && (
        <Card
          title={`Assigned to you (${mine.length}${mine.length === 5 ? "+" : ""})`}
          className="mt-6 border-l-4 border-l-amber-500"
          actions={<Link href="/incidents?assignee=me&status=unresolved" className="text-sm font-medium text-brand-600 hover:underline">View all</Link>}
        >
          <ul className="-mx-4 -my-2 divide-y divide-slate-100">
            {mine.map((r) => (
              <li key={r.id}>
                <Link href={`/incidents/${r.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 hover:bg-slate-50">
                  <span className="w-16 font-mono text-sm font-medium text-slate-900">{incidentRef(r.number)}</span>
                  <TypeBadge type={r.type} />
                  <span className="order-last w-full min-w-0 truncate text-sm text-slate-700 sm:order-none sm:w-auto sm:flex-1">
                    {r.suppliers?.name ?? "No supplier"}{r.po_number ? ` · ${r.po_number}` : ""}
                  </span>
                  <span className="ml-auto text-xs text-slate-500 sm:ml-0"><LocalTime value={r.occurred_at} mode="relative" /></span>
                  <StatusBadge status={r.status} />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <PatternsCard p={patternData as Patterns | null} className="mt-6" />

      <div className="mt-6">
        <Card title="Recent incidents" actions={<Link href="/incidents" className="text-sm font-medium text-brand-600 hover:underline">View all</Link>}>
          {recent.length === 0 ? (
            <EmptyState
              title="No incidents yet"
              description="When your team reports a receiving exception, it will show up here."
              action={can.createIncident(ctx.org.role) && !noFacilities ? <LinkButton href="/incidents/new">Report the first exception</LinkButton> : undefined}
            />
          ) : (
            <ul className="-mx-4 -my-2 divide-y divide-slate-100">
              {recent.map((r) => (
                <li key={r.id}>
                  <Link href={`/incidents/${r.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 hover:bg-slate-50">
                    <span className="w-16 font-mono text-sm font-medium text-slate-900">{incidentRef(r.number)}</span>
                    <TypeBadge type={r.type} />
                    <span className="order-last w-full min-w-0 truncate text-sm text-slate-700 sm:order-none sm:w-auto sm:flex-1">
                      {r.suppliers?.name ?? "No supplier"}
                      {r.po_number ? ` · ${r.po_number}` : ""}
                      {!ctx.facility && r.facilities ? ` · ${r.facilities.name}` : ""}
                    </span>
                    <span className="ml-auto text-xs text-slate-500 sm:ml-0">
                      <LocalTime value={r.occurred_at} mode="relative" />
                    </span>
                    <StatusBadge status={r.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}

function formatHours(h: number) {
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} min`;
  if (h < 48) return `${h.toFixed(1)} hr`;
  return `${(h / 24).toFixed(1)} days`;
}
