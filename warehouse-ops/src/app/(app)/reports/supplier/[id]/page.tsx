import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft, Download } from "lucide-react";
import { z } from "zod";
import { Alert, buttonClass } from "@/components/ui";
import { requireAppContext } from "@/lib/context";
import { dayRange } from "@/lib/incident-query";
import { EXCEPTION_LABELS, STATUS_LABELS, formatQty, incidentRef, type ExceptionType, type IncidentStatus } from "@/lib/labels";
import { incidentFilterSchema } from "@/lib/validation";
import { DraftMessage, PrintButton } from "./ReportTools";

export const metadata: Metadata = { title: "Supplier discrepancy report" };

type Row = {
  id: string;
  number: number;
  type: ExceptionType;
  status: IncidentStatus;
  occurred_at: string;
  po_number: string | null;
  shipment_ref: string | null;
  sku: string | null;
  item_description: string | null;
  expected_qty: number | null;
  received_qty: number | null;
  description: string;
  facilities: { name: string } | null;
};

const iso = (d: Date) => d.toISOString().slice(0, 10);
const fmtDate = (s: string) => new Date(s).toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" });

export default async function SupplierReportPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const ctx = await requireAppContext();
  const { id } = await params;
  const sp = await searchParams;
  if (!z.uuid().safeParse(id).success) notFound();
  const { data: supplier } = await ctx.supabase.from("suppliers").select("id, name").eq("id", id).eq("org_id", ctx.org.orgId).maybeSingle();
  if (!supplier) notFound();

  const f = incidentFilterSchema.parse({ from: sp.from, to: sp.to, facility: sp.facility });
  const today = new Date();
  const from = f.from ?? iso(new Date(today.getTime() - 89 * 86_400_000));
  const to = f.to ?? iso(today);
  const facilityId = f.facility && ctx.facilities.some((x) => x.id === f.facility) ? f.facility : undefined;
  const { fromIso, toIso } = dayRange(from, to);

  let q = ctx.supabase
    .from("incidents")
    .select("id, number, type, status, occurred_at, po_number, shipment_ref, sku, item_description, expected_qty, received_qty, description, facilities(name)")
    .eq("org_id", ctx.org.orgId)
    .eq("supplier_id", id)
    .gte("occurred_at", fromIso!)
    .lt("occurred_at", toIso!)
    .order("occurred_at")
    .limit(500);
  if (facilityId) q = q.eq("facility_id", facilityId);
  const { data } = await q;
  const rows = (data ?? []) as unknown as Row[];

  const ids = rows.map((r) => r.id);
  const { data: att } = ids.length
    ? await ctx.supabase.from("incident_attachments").select("incident_id, kind").in("incident_id", ids)
    : { data: [] };
  const evidence = new Map<string, { bol: number; photos: number }>();
  for (const a of att ?? []) {
    const e = evidence.get(a.incident_id as string) ?? { bol: 0, photos: 0 };
    if (a.kind === "signed_bol") e.bol++;
    else e.photos++;
    evidence.set(a.incident_id as string, e);
  }

  const diff = (r: Row) => (r.expected_qty !== null && r.received_qty !== null ? Number(r.received_qty) - Number(r.expected_qty) : null);
  const byType = new Map<ExceptionType, number>();
  rows.forEach((r) => byType.set(r.type, (byType.get(r.type) ?? 0) + 1));
  const unitsShort = rows.filter((r) => r.type === "shortage").reduce((s, r) => s + Math.max(0, -(diff(r) ?? 0)), 0);
  const unitsOver = rows.filter((r) => r.type === "overage").reduce((s, r) => s + Math.max(0, diff(r) ?? 0), 0);
  const unresolved = rows.filter((r) => r.status === "open" || r.status === "in_progress");
  const withBol = rows.filter((r) => (evidence.get(r.id)?.bol ?? 0) > 0).length;
  const breakdown = [...byType.entries()].map(([t, n]) => `${n} ${EXCEPTION_LABELS[t].toLowerCase()}`).join(", ");
  const sender = ctx.profile.full_name || ctx.profile.email;
  const respondBy = fmtDate(new Date(today.getTime() + 7 * 86_400_000).toISOString());

  const requests: string[] = [];
  if (unitsShort > 0) requests.push(`- A credit or reship for ${formatQty(unitsShort)} units short (see shortage lines below).`);
  if (byType.get("damaged")) requests.push(`- Credit or replacement for damaged product on ${byType.get("damaged")} shipment(s), and a review of packaging/loading.`);
  if (byType.get("wrong_item")) requests.push(`- Correct items and return instructions (RMA) for ${byType.get("wrong_item")} wrong-item shipment(s).`);
  if (unitsOver > 0) requests.push(`- Instructions for ${formatQty(unitsOver)} units received over the ordered quantity (return, invoice or hold).`);
  if (byType.get("other")) requests.push(`- A response on ${byType.get("other")} other receiving issue(s) listed below.`);

  const lineText = rows
    .map((r) => {
      const d = diff(r);
      return `${incidentRef(r.number)}  ${fmtDate(r.occurred_at)}  ${EXCEPTION_LABELS[r.type]}  PO ${r.po_number ?? "n/a"}${r.shipment_ref ? `  BOL ${r.shipment_ref}` : ""}${r.sku ? `  SKU ${r.sku}` : ""}${d !== null ? `  expected ${formatQty(r.expected_qty)}, received ${formatQty(r.received_qty)}` : ""}`;
    })
    .join("\n");

  const draft = `Subject: Receiving discrepancies ${fmtDate(fromIso!)} – ${fmtDate(new Date(Date.parse(toIso!) - 1).toISOString())}

Hello ${supplier.name} team,

Between ${fmtDate(fromIso!)} and ${fmtDate(new Date(Date.parse(toIso!) - 1).toISOString())}, ${ctx.org.orgName} recorded ${rows.length} receiving discrepanc${rows.length === 1 ? "y" : "ies"} on shipments from ${supplier.name}${breakdown ? ` (${breakdown})` : ""}.

We request:
${requests.join("\n") || "- Your review of the discrepancies listed below."}

Please reply with your corrective action by ${respondBy}.

${lineText}

Photos and signed delivery receipts are on file for ${withBol} of ${rows.length} shipments and available on request.

Thank you,
${sender}
${ctx.org.orgName}`;

  const exportHref = `/incidents/export?${new URLSearchParams({ supplier: id, from, to, ...(facilityId ? { facility: facilityId } : {}) })}`;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="print:hidden">
        <Link href={`/reports?${new URLSearchParams({ from, to })}`} className="mb-4 inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900">
          <ArrowLeft className="h-4 w-4" aria-hidden /> Reports
        </Link>
        <form method="get" className="card mb-4 flex flex-wrap items-end gap-3 p-4">
          <div>
            <label htmlFor="from" className="label">From</label>
            <input id="from" name="from" type="date" defaultValue={from} className="input" />
          </div>
          <div>
            <label htmlFor="to" className="label">To</label>
            <input id="to" name="to" type="date" defaultValue={to} className="input" />
          </div>
          <div>
            <label htmlFor="facility" className="label">Facility</label>
            <select id="facility" name="facility" defaultValue={facilityId ?? ""} className="input">
              <option value="">All facilities</option>
              {ctx.facilities.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
          </div>
          <button className={buttonClass("secondary")}>Update</button>
          <span className="ml-auto flex flex-wrap gap-2">
            <a href={exportHref} className={buttonClass("secondary")}><Download className="h-4 w-4" aria-hidden /> CSV</a>
            <PrintButton />
          </span>
        </form>
        <div className="mb-4">
          <Alert tone="info">This is a draft for you to review. Warehouse Ops never sends anything to suppliers. Print it, save it as PDF, or copy the message into your email.</Alert>
        </div>
      </div>

      <article className="card p-6 print:border-0 print:p-0 print:shadow-none">
        <header className="mb-6 border-b border-slate-200 pb-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Receiving discrepancy report</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">{supplier.name}</h1>
          <p className="mt-1 text-sm text-slate-600">
            From {ctx.org.orgName} · {fmtDate(fromIso!)} – {fmtDate(new Date(Date.parse(toIso!) - 1).toISOString())}
            {facilityId ? ` · ${ctx.facilities.find((x) => x.id === facilityId)?.name}` : ""} · Prepared by {sender}
          </p>
        </header>

        {rows.length === 0 ? (
          <p className="text-sm text-slate-600">No receiving exceptions were recorded for {supplier.name} in this period.</p>
        ) : (
          <>
            <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ["Discrepancies", rows.length.toLocaleString()],
                ["Units short", formatQty(unitsShort)],
                ["Units over", formatQty(unitsOver)],
                ["Still unresolved", unresolved.length.toLocaleString()],
              ].map(([l, v]) => (
                <div key={l} className="rounded-md border border-slate-200 px-3 py-2">
                  <p className="text-xs text-slate-500">{l}</p>
                  <p className="text-xl font-semibold tabular-nums text-slate-900">{v}</p>
                </div>
              ))}
            </section>
            <p className="mb-4 text-sm text-slate-700">
              By type: {breakdown}. Signed delivery receipt on file for {withBol} of {rows.length} shipments.
            </p>

            <div className="-mx-6 mb-8 overflow-x-auto print:mx-0 print:overflow-visible print:break-inside-auto">
              <table className="w-full min-w-[760px] text-sm print:min-w-0 print:text-[10px]">
                <thead className="border-y border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-6 py-2 font-medium print:px-1">Ref</th>
                    <th className="px-2 py-2 font-medium">Date</th>
                    <th className="px-2 py-2 font-medium">Type</th>
                    <th className="px-2 py-2 font-medium">PO / BOL</th>
                    <th className="px-2 py-2 font-medium">SKU / item</th>
                    <th className="px-2 py-2 text-right font-medium">Exp.</th>
                    <th className="px-2 py-2 text-right font-medium">Rec.</th>
                    <th className="px-2 py-2 text-right font-medium">Var.</th>
                    <th className="px-2 py-2 font-medium">Evidence</th>
                    <th className="px-6 py-2 font-medium print:px-1">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 align-top">
                  {rows.map((r) => {
                    const d = diff(r);
                    const e = evidence.get(r.id);
                    return (
                      <tr key={r.id}>
                        <td className="px-6 py-2 font-mono print:px-1">
                          <Link href={`/incidents/${r.id}`} className="text-brand-700 hover:underline print:text-slate-900 print:no-underline">{incidentRef(r.number)}</Link>
                        </td>
                        <td className="whitespace-nowrap px-2 py-2">{fmtDate(r.occurred_at)}</td>
                        <td className="px-2 py-2">{EXCEPTION_LABELS[r.type]}</td>
                        <td className="px-2 py-2 break-words">{r.po_number ?? "—"}{r.shipment_ref && <span className="block text-xs text-slate-500 print:text-[10px]">{r.shipment_ref}</span>}</td>
                        <td className="max-w-48 px-2 py-2 print:max-w-none">{r.sku ?? "—"}{r.item_description && <span className="block truncate text-xs text-slate-500 print:whitespace-normal print:text-[10px]">{r.item_description}</span>}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{formatQty(r.expected_qty)}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{formatQty(r.received_qty)}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{d === null ? "—" : `${d > 0 ? "+" : ""}${formatQty(d)}`}</td>
                        <td className="whitespace-nowrap px-2 py-2 text-xs print:text-[10px]">
                          {e?.bol ? "Signed BOL" : "No BOL"}{e?.photos ? ` · ${e.photos} photo${e.photos === 1 ? "" : "s"}` : ""}
                        </td>
                        <td className="px-6 py-2 print:px-1">{STATUS_LABELS[r.status]}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        <section className="print:break-before-page">
          <h2 className="mb-2 text-sm font-semibold text-slate-900">Message to {supplier.name}</h2>
          <DraftMessage initial={draft} />
        </section>
      </article>
    </div>
  );
}
