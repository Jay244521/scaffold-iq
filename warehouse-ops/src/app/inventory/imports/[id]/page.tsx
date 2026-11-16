import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";
import { LocalTime, SubmitButton } from "@/components/client";
import { Alert, Card, buttonClass, cx } from "@/components/ui";
import { getMembers, requireAppContext } from "@/lib/context";
import { LINE_STATUS_LABELS } from "@/lib/inventory";
import { formatQty } from "@/lib/labels";
import { can } from "@/lib/permissions";
import { applyInventoryImport, decideInventoryLines, discardInventoryImport } from "../../actions";
import { SelectAll } from "./SelectAll";

export const metadata: Metadata = { title: "Review inventory import" };

type Import = {
  id: string;
  facility_id: string;
  source: "count" | "system";
  file_name: string;
  status: "pending_review" | "applied" | "discarded";
  total_rows: number;
  invalid_rows: number;
  discrepancy_rows: number;
  new_rows: number;
  match_rows: number;
  applied_rows: number;
  stale_rows: number;
  created_by: string | null;
  created_at: string;
  closed_by: string | null;
  closed_at: string | null;
};
type Line = {
  id: string;
  line_no: number;
  sku: string | null;
  location: string;
  description: string | null;
  qty: number | null;
  unit_cost: number | null;
  recorded_qty: number | null;
  status: string;
  error: string | null;
  decision: string;
  decided_by: string | null;
  applied_at: string | null;
};

const PAGE = 200;
const FILTERS = [
  ["actionable", "To review"],
  ["discrepancy", "Discrepancies"],
  ["new_item", "Not in records"],
  ["invalid", "Invalid"],
  ["match", "Matches"],
  ["stale", "Record changed"],
  ["all", "All rows"],
] as const;

const statusStyle: Record<string, string> = {
  invalid: "bg-red-50 text-red-800 ring-red-200",
  discrepancy: "bg-amber-50 text-amber-900 ring-amber-200",
  new_item: "bg-sky-50 text-sky-900 ring-sky-200",
  match: "bg-slate-100 text-slate-700 ring-slate-200",
  stale: "bg-purple-50 text-purple-900 ring-purple-200",
};
const decisionStyle: Record<string, string> = {
  approved: "text-emerald-700",
  rejected: "text-red-700",
  pending: "text-slate-500",
  not_applicable: "text-slate-400",
};
const decisionLabel: Record<string, string> = { approved: "Approved", rejected: "Rejected", pending: "Needs decision", not_applicable: "—" };

const NOTICES: Record<string, [tone: "success" | "warning" | "error" | "info", text: string]> = {
  created: ["success", "Saved for review. No inventory quantities have changed."],
  decided: ["success", "Decisions saved. Nothing changes in inventory until you apply approved corrections."],
  select: ["warning", "Select at least one row first."],
  confirm: ["warning", "Tick the confirmation box to apply corrections."],
  discarded: ["info", "Import discarded. No inventory quantities were changed."],
  error: ["error", "That didn't work. Refresh the page and try again."],
};

export default async function ImportReviewPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const ctx = await requireAppContext();
  const { id } = await params;
  const sp = await searchParams;
  if (!z.uuid().safeParse(id).success) notFound();
  const { data: imp } = await ctx.supabase.from("inventory_imports").select("*").eq("id", id).eq("org_id", ctx.org.orgId).maybeSingle();
  if (!imp) notFound();
  const im = imp as Import;

  const show = FILTERS.some(([k]) => k === sp.show) ? (sp.show as (typeof FILTERS)[number][0]) : im.status === "pending_review" ? "actionable" : "all";
  const page = Math.max(1, Number(sp.page) || 1);
  let q = ctx.supabase
    .from("inventory_import_lines")
    .select("id, line_no, sku, location, description, qty, unit_cost, recorded_qty, status, error, decision, decided_by, applied_at", { count: "exact" })
    .eq("import_id", id)
    .order("line_no");
  if (show === "actionable") q = q.in("status", ["discrepancy", "new_item"]);
  else if (show !== "all") q = q.eq("status", show);
  const [{ data: lineData, count }, { count: approvedCount }, { count: pendingCount }, members] = await Promise.all([
    q.range((page - 1) * PAGE, page * PAGE - 1),
    ctx.supabase.from("inventory_import_lines").select("id", { count: "exact", head: true }).eq("import_id", id).eq("decision", "approved").is("applied_at", null).in("status", ["discrepancy", "new_item"]),
    ctx.supabase.from("inventory_import_lines").select("id", { count: "exact", head: true }).eq("import_id", id).eq("decision", "pending"),
    getMembers(ctx.org.orgId),
  ]);
  const lines = (lineData ?? []) as Line[];
  const nameOf = (u: string | null) => (u ? (members.find((m) => m.userId === u)?.name ?? "Former member") : "—");
  const facility = ctx.facilities.find((f) => f.id === im.facility_id)?.name ?? "Facility";
  const open = im.status === "pending_review";
  const canApprove = can.approveInventory(ctx.org.role) && open;
  const canDiscard = open && (can.approveInventory(ctx.org.role) || im.created_by === ctx.user.id);
  const notice = sp.notice ? NOTICES[sp.notice] : null;
  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE));
  const hrefFor = (p: Record<string, string>) => `/inventory/imports/${id}?${new URLSearchParams({ show, ...p })}`;
  const hasCost = lines.some((l) => l.unit_cost !== null);

  return (
    <>
      <Link href="/inventory" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Inventory
      </Link>
      <div className="mb-2 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">{im.file_name}</h1>
        <span
          className={cx(
            "rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
            open ? "bg-amber-50 text-amber-900 ring-amber-200" : im.status === "applied" ? "bg-emerald-50 text-emerald-800 ring-emerald-200" : "bg-slate-100 text-slate-700 ring-slate-200",
          )}
        >
          {open ? "Awaiting review" : im.status === "applied" ? "Applied" : "Discarded"}
        </span>
      </div>
      <p className="mb-6 text-sm text-slate-600">
        {im.source === "count" ? "Physical count" : "WMS / ERP export"} · {facility} · uploaded by {nameOf(im.created_by)} <LocalTime value={im.created_at} />
        {im.closed_at && (
          <>
            {" "}· {im.status === "applied" ? "applied" : "discarded"} by {nameOf(im.closed_by)} <LocalTime value={im.closed_at} />
          </>
        )}
      </p>

      <div className="mb-4 space-y-3">
        {notice && <Alert tone={notice[0]}>{notice[1]}</Alert>}
        {sp.notice === "applied" && (
          <Alert tone={Number(sp.stale) ? "warning" : "success"}>
            Applied {sp.applied} correction{sp.applied === "1" ? "" : "s"} to inventory records.
            {Number(sp.stale) > 0 && ` ${sp.stale} were not applied because the record changed after this file was uploaded. They're marked "Record changed"; upload a fresh count to review them.`}
          </Alert>
        )}
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          ["Rows", im.total_rows],
          ["Discrepancies", im.discrepancy_rows],
          ["Not in records", im.new_rows],
          ["Match records", im.match_rows],
          ["Invalid", im.invalid_rows],
          [open ? "Approved, not yet applied" : "Applied", open ? (approvedCount ?? 0) : im.applied_rows],
        ].map(([label, v]) => (
          <div key={label as string} className="card px-3 py-2">
            <p className="text-xs text-slate-500">{label}</p>
            <p className="text-xl font-semibold tabular-nums text-slate-900">{(v as number).toLocaleString()}</p>
          </div>
        ))}
      </div>

      {canApprove && (
        <Card title="Apply approved corrections" className="mb-6">
          <form action={applyInventoryImport} className="space-y-3">
            <input type="hidden" name="importId" value={id} />
            <p className="text-sm text-slate-700">
              <strong>{approvedCount ?? 0}</strong> approved correction{approvedCount === 1 ? "" : "s"} will update {facility}&apos;s inventory records.
              {(pendingCount ?? 0) > 0 && ` ${pendingCount} row${pendingCount === 1 ? "" : "s"} still need a decision and will not be changed.`} Rejected rows are never applied. Every change is logged with your name.
            </p>
            <label className="flex items-start gap-2 text-sm text-slate-800">
              <input type="checkbox" name="confirm" value="yes" className="mt-0.5" required />
              I have reviewed these corrections and want to update the inventory records.
            </label>
            <div className="flex flex-wrap gap-2">
              <SubmitButton pendingText="Applying…" disabled={!approvedCount}>
                Apply {approvedCount ?? 0} approved correction{approvedCount === 1 ? "" : "s"}
              </SubmitButton>
            </div>
          </form>
        </Card>
      )}

      <nav className="mb-3 flex flex-wrap gap-1 text-sm" aria-label="Filter rows">
        {FILTERS.map(([k, label]) => (
          <Link key={k} href={hrefFor({ show: k })} aria-current={show === k ? "true" : undefined} className={cx("rounded-md px-2.5 py-1", show === k ? "bg-brand-600 text-white" : "text-slate-700 hover:bg-slate-100")}>
            {label}
          </Link>
        ))}
      </nav>

      <form action={decideInventoryLines} className="card">
        <input type="hidden" name="importId" value={id} />
        <input type="hidden" name="show" value={show} />
        {canApprove && (
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-4 py-3">
            <SelectAll />
            <span className="mx-1 hidden h-5 w-px bg-slate-200 sm:block" />
            <button name="decision" value="approved" className={buttonClass("secondary", "sm", "text-emerald-800")}>Approve selected</button>
            <button name="decision" value="rejected" className={buttonClass("secondary", "sm", "text-red-700")}>Reject selected</button>
            <button name="decision" value="pending" className={buttonClass("ghost", "sm")}>Clear decision</button>
            <span className="ml-auto" />
            <button name="decision" value="approve_all" className={buttonClass("ghost", "sm")}>
              Approve all rows to review
            </button>
          </div>
        )}
        {lines.length === 0 ? (
          <p className="p-6 text-center text-sm text-slate-500">No rows in this view.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  {canApprove && <th className="w-10 px-4 py-2"><span className="sr-only">Select</span></th>}
                  <th className="px-3 py-2 font-medium">Row</th>
                  <th className="px-3 py-2 font-medium">SKU / location</th>
                  <th className="px-3 py-2 text-right font-medium">Record</th>
                  <th className="px-3 py-2 text-right font-medium">File</th>
                  <th className="px-3 py-2 text-right font-medium">Difference</th>
                  {hasCost && <th className="px-3 py-2 text-right font-medium">Value</th>}
                  <th className="px-3 py-2 font-medium">Result</th>
                  <th className="px-4 py-2 font-medium">Decision</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 tabular-nums">
                {lines.map((l) => {
                  const diff = l.qty !== null && l.recorded_qty !== null ? Math.round((l.qty - l.recorded_qty) * 1000) / 1000 : null;
                  const actionable = canApprove && (l.status === "discrepancy" || l.status === "new_item");
                  return (
                    <tr key={l.id} className={l.decision === "approved" && !l.applied_at ? "bg-emerald-50/40" : ""}>
                      {canApprove && (
                        <td className="px-4 py-2">
                          {actionable && <input type="checkbox" name="lineId" value={l.id} aria-label={`Select row ${l.line_no}`} />}
                        </td>
                      )}
                      <td className="px-3 py-2 text-slate-500">{l.line_no}</td>
                      <td className="max-w-64 px-3 py-2">
                        <p className="truncate font-mono text-xs text-slate-900">{l.sku || "—"}{l.location && <span className="text-slate-500"> · {l.location}</span>}</p>
                        {l.description && <p className="truncate text-xs text-slate-500">{l.description}</p>}
                      </td>
                      <td className="px-3 py-2 text-right">{formatQty(l.recorded_qty)}</td>
                      <td className="px-3 py-2 text-right">{formatQty(l.qty)}</td>
                      <td className={cx("px-3 py-2 text-right", (diff ?? 0) < 0 ? "text-red-700" : (diff ?? 0) > 0 ? "text-amber-800" : "")}>
                        {diff === null ? "—" : `${diff > 0 ? "+" : ""}${formatQty(diff)}`}
                      </td>
                      {hasCost && (
                        <td className="px-3 py-2 text-right">
                          {diff !== null && l.unit_cost !== null ? `${diff < 0 ? "-" : ""}$${Math.abs(diff * Number(l.unit_cost)).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}
                        </td>
                      )}
                      <td className="px-3 py-2">
                        <span className={cx("inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset", statusStyle[l.status])}>{LINE_STATUS_LABELS[l.status]}</span>
                        {l.error && <p className="mt-0.5 text-xs text-red-700">{l.error}</p>}
                      </td>
                      <td className={cx("px-4 py-2 text-xs font-medium", decisionStyle[l.decision])}>
                        {l.applied_at ? <span className="text-emerald-700">Applied</span> : decisionLabel[l.decision]}
                        {l.decided_by && l.decision !== "pending" && <span className="block font-normal text-slate-500">{nameOf(l.decided_by)}</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </form>

      {pages > 1 && (
        <nav className="mt-3 flex items-center justify-between text-sm" aria-label="Pagination">
          <span className="text-slate-600">Page {page} of {pages}</span>
          <div className="flex gap-2">
            {page > 1 && <Link href={hrefFor({ page: String(page - 1) })} className={buttonClass("secondary", "sm")}>Previous</Link>}
            {page < pages && <Link href={hrefFor({ page: String(page + 1) })} className={buttonClass("secondary", "sm")}>Next</Link>}
          </div>
        </nav>
      )}

      {!can.approveInventory(ctx.org.role) && open && (
        <p className="mt-4 text-sm text-slate-600">A manager, admin or owner reviews and applies these corrections.</p>
      )}
      {canDiscard && (
        <form action={discardInventoryImport} className="mt-6">
          <input type="hidden" name="importId" value={id} />
          <button className="text-sm text-red-700 hover:underline">Discard this import without changing anything</button>
        </form>
      )}
    </>
  );
}
