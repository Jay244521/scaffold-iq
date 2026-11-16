import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft, FileCheck, FileText, Trash2 } from "lucide-react";
import { z } from "zod";
import { LocalTime } from "@/components/client";
import { Alert, Card, StatusBadge, TypeBadge, cx } from "@/components/ui";
import { getMembers, requireAppContext } from "@/lib/context";
import { EVIDENCE_BUCKET } from "@/lib/env";
import { EXCEPTION_LABELS, STATUS_LABELS, formatBytes, formatQty, incidentRef, variance, type ExceptionType, type IncidentStatus } from "@/lib/labels";
import { can, canUpdateIncident } from "@/lib/permissions";
import { suggestNextSteps } from "@/lib/next-steps";
import { deleteEvidence } from "../actions";
import { AssignForm, CommentForm, EvidenceUploader, StatusForm } from "./IncidentControls";

export const metadata: Metadata = { title: "Incident" };

type Incident = {
  id: string;
  org_id: string;
  number: number;
  type: ExceptionType;
  status: IncidentStatus;
  po_number: string | null;
  shipment_ref: string | null;
  sku: string | null;
  item_description: string | null;
  expected_qty: number | null;
  received_qty: number | null;
  description: string;
  occurred_at: string;
  reported_by: string | null;
  assigned_to: string | null;
  resolution_notes: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
  supplier_id: string | null;
  suppliers: { name: string } | null;
  facilities: { name: string } | null;
};
type Comment = { id: string; author_id: string; body: string; created_at: string };
type Event = { id: number; actor_id: string | null; event_type: string; from_value: string | null; to_value: string | null; metadata: { fields?: string[] }; created_at: string };
type Attachment = { id: string; storage_path: string; file_name: string; mime_type: string; size_bytes: number; uploaded_by: string; created_at: string; kind: string };

export default async function IncidentPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string; failed?: string; updated?: string }> }) {
  const ctx = await requireAppContext();
  const { id } = await params;
  const sp = await searchParams;
  if (!z.uuid().safeParse(id).success) notFound();

  const { data } = await ctx.supabase
    .from("incidents")
    .select("*, suppliers(name), facilities(name)")
    .eq("id", id)
    .eq("org_id", ctx.org.orgId)
    .maybeSingle();
  if (!data) notFound();
  const inc = data as unknown as Incident;

  const [{ data: comments }, { data: events }, { data: attachments }, members] = await Promise.all([
    ctx.supabase.from("incident_comments").select("id, author_id, body, created_at").eq("incident_id", id).order("created_at"),
    ctx.supabase.from("incident_events").select("id, actor_id, event_type, from_value, to_value, metadata, created_at").eq("incident_id", id).order("created_at"),
    ctx.supabase.from("incident_attachments").select("id, storage_path, file_name, mime_type, size_bytes, uploaded_by, created_at, kind").eq("incident_id", id).order("created_at"),
    getMembers(ctx.org.orgId),
  ]);
  const files = (attachments ?? []) as Attachment[];
  const bols = files.filter((f) => f.kind === "signed_bol");
  const others = files.filter((f) => f.kind !== "signed_bol");
  const nameOf = (uid: string | null) => (uid ? (members.find((m) => m.userId === uid)?.name ?? "Former member") : "System");

  // Short-lived links to private files, issued only after the database confirmed access.
  const signed = files.length
    ? (await ctx.supabase.storage.from(EVIDENCE_BUCKET).createSignedUrls(files.map((f) => f.storage_path), 600)).data ?? []
    : [];
  const urlFor = new Map(signed.map((s) => [s.path, s.signedUrl]));

  const role = ctx.org.role;
  const steps = suggestNextSteps({
    type: inc.type,
    status: inc.status,
    supplierName: inc.suppliers?.name ?? null,
    poNumber: inc.po_number,
    shipmentRef: inc.shipment_ref,
    expectedQty: inc.expected_qty,
    receivedQty: inc.received_qty,
    assignedTo: inc.assigned_to,
    photoCount: others.length,
    bolCount: bols.length,
    commentCount: (comments ?? []).length,
    ageDays: (Date.now() - Date.parse(inc.created_at)) / 86_400_000,
  });
  const mayUpdate = canUpdateIncident(role, ctx.user.id, inc);
  const diff = variance(inc.expected_qty, inc.received_qty);

  const timeline = [
    ...((comments ?? []) as Comment[]).map((c) => ({ kind: "comment" as const, at: c.created_at, key: `c${c.id}`, c })),
    ...((events ?? []) as Event[]).filter((e) => e.event_type !== "comment_added").map((e) => ({ kind: "event" as const, at: e.created_at, key: `e${e.id}`, e })),
  ].sort((a, b) => a.at.localeCompare(b.at));

  const describe = (e: Event) => {
    switch (e.event_type) {
      case "created":
        return "reported this incident";
      case "status_changed":
        return `changed status from ${STATUS_LABELS[e.from_value as IncidentStatus] ?? e.from_value} to ${STATUS_LABELS[e.to_value as IncidentStatus] ?? e.to_value}`;
      case "assigned":
        return e.to_value ? `assigned this to ${nameOf(e.to_value)}` : "removed the assignment";
      case "resolution_notes_updated":
        return "updated the resolution notes";
      case "details_updated":
        return `edited ${(e.metadata.fields ?? []).join(", ").replace(/_/g, " ")}`;
      case "signed_bol_added":
        return `added signed BOL: ${e.to_value}`;
      case "signed_bol_removed":
        return `removed signed BOL: ${e.from_value}`;
      case "evidence_added":
        return `added evidence: ${e.to_value}`;
      case "evidence_removed":
        return `removed evidence: ${e.from_value}`;
      default:
        return e.event_type.replace(/_/g, " ");
    }
  };

  const details: [string, React.ReactNode][] = [
    ["Facility", inc.facilities?.name],
    ["Supplier", inc.suppliers?.name ?? "—"],
    ["PO number", inc.po_number ?? "—"],
    ["Shipment reference", inc.shipment_ref ?? "—"],
    ["SKU", inc.sku ?? "—"],
    ["Item", inc.item_description ?? "—"],
    ["Expected qty", formatQty(inc.expected_qty)],
    ["Received qty", formatQty(inc.received_qty)],
    ["Variance", diff === null ? "—" : <span className={diff < 0 ? "text-red-700" : diff > 0 ? "text-amber-800" : ""}>{`${diff > 0 ? "+" : ""}${formatQty(diff)}`}</span>],
    ["Occurred", <LocalTime key="o" value={inc.occurred_at} />],
    ["Reported by", `${nameOf(inc.reported_by)}`],
    ["Reported at", <LocalTime key="r" value={inc.created_at} />],
    ["Responsible", inc.assigned_to ? nameOf(inc.assigned_to) : "Unassigned"],
    ["Resolved", inc.resolved_at ? <span key="res">{<LocalTime value={inc.resolved_at} />} by {nameOf(inc.resolved_by)}</span> : "—"],
  ];

  const tile = (f: Attachment) => {
    const url = urlFor.get(f.storage_path);
    const isImage = f.mime_type.startsWith("image/") && !f.mime_type.includes("hei");
    return (
                    <li key={f.id} className="overflow-hidden rounded-md border border-slate-200">
                      <a href={url ?? "#"} target="_blank" rel="noopener noreferrer" className="block bg-slate-50">
                        {isImage && url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={url} alt={f.file_name} className="aspect-[4/3] w-full object-cover" loading="lazy" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="flex aspect-[4/3] items-center justify-center">
                            <FileText className="h-10 w-10 text-slate-400" aria-hidden />
                          </div>
                        )}
                      </a>
                      <div className="flex items-center gap-1 px-2 py-1.5">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium text-slate-900" title={f.file_name}>
                            {f.file_name}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {formatBytes(f.size_bytes)} · {nameOf(f.uploaded_by)}
                          </p>
                        </div>
                        {can.deleteEvidence(role) && (
                          <form action={deleteEvidence}>
                            <input type="hidden" name="attachmentId" value={f.id} />
                            <button className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-700" aria-label={`Delete ${f.file_name}`} title="Delete">
                              <Trash2 className="h-4 w-4" aria-hidden />
                            </button>
                          </form>
                        )}
                      </div>
                    </li>
    );
  };

  return (
    <>
      <Link href="/incidents" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" aria-hidden /> All incidents
      </Link>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="font-mono text-2xl font-semibold text-slate-900">{incidentRef(inc.number)}</h1>
        <TypeBadge type={inc.type} />
        <StatusBadge status={inc.status} />
        {can.editIncidentDetails(role) && (
          <Link href={`/incidents/${inc.id}/edit`} className="ml-auto text-sm font-medium text-brand-600 hover:underline">
            Edit details
          </Link>
        )}
      </div>

      <div className="mb-4 space-y-3">
        {sp.created && <Alert tone="success">Exception {incidentRef(inc.number)} was reported.</Alert>}
        {sp.updated && <Alert tone="success">Changes saved. They're recorded in the activity history below.</Alert>}
        {sp.failed && <Alert tone="warning">{sp.failed} file(s) could not be uploaded. You can add them again below.</Alert>}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title={`${EXCEPTION_LABELS[inc.type]} details`}>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              {details.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 border-b border-slate-100 pb-2 sm:block sm:border-0 sm:pb-0">
                  <dt className="text-slate-500">{k}</dt>
                  <dd className="text-right font-medium text-slate-900 sm:text-left">{v}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-5">
              <h3 className="text-sm font-medium text-slate-500">Description</h3>
              <p className="mt-1 whitespace-pre-wrap text-sm text-slate-900">{inc.description}</p>
            </div>
            {inc.resolution_notes && (
              <div className="mt-5 rounded-md bg-emerald-50 p-3">
                <h3 className="text-sm font-medium text-emerald-900">Resolution notes</h3>
                <p className="mt-1 whitespace-pre-wrap text-sm text-emerald-950">{inc.resolution_notes}</p>
              </div>
            )}
          </Card>

          <Card title={`Evidence (${files.length})`}>
            <section aria-labelledby="bol-heading" className={cx("mb-5 rounded-md border p-3", bols.length ? "border-emerald-200 bg-emerald-50/50" : "border-amber-200 bg-amber-50/60")}>
              <div className="mb-2 flex items-center gap-2">
                <FileCheck className={cx("h-4 w-4", bols.length ? "text-emerald-700" : "text-amber-700")} aria-hidden />
                <h3 id="bol-heading" className="text-sm font-semibold text-slate-900">Signed BOL / delivery receipt</h3>
              </div>
              {bols.length ? (
                <ul className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-3">{bols.map(tile)}</ul>
              ) : (
                <p className="mb-3 text-sm text-amber-900">No signed BOL attached yet. It&apos;s the proof of what was signed for at the dock.</p>
              )}
              {can.uploadEvidence(role) && (
                <EvidenceUploader orgId={inc.org_id} incidentId={inc.id} kind="signed_bol" label={bols.length ? "Add another BOL page" : "Add signed BOL"} />
              )}
            </section>

            <h3 className="mb-2 text-sm font-semibold text-slate-900">Photos and documents</h3>
            {others.length === 0 ? (
              <p className="mb-3 text-sm text-slate-500">No photos or documents yet.</p>
            ) : (
              <ul className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">{others.map(tile)}</ul>
            )}
            {can.uploadEvidence(role) && <EvidenceUploader orgId={inc.org_id} incidentId={inc.id} />}
          </Card>

          <Card title="Activity and comments">
            <ol className="space-y-4">
              {timeline.map((t) =>
                t.kind === "comment" ? (
                  <li key={t.key} className="rounded-md border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs text-slate-500">
                      <span className="font-medium text-slate-900">{nameOf(t.c.author_id)}</span> commented · <LocalTime value={t.at} />
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-slate-900">{t.c.body}</p>
                  </li>
                ) : (
                  <li key={t.key} className="flex gap-2 text-sm text-slate-600">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" aria-hidden />
                    <p>
                      <span className="font-medium text-slate-900">{nameOf(t.e.actor_id)}</span> {describe(t.e)} ·{" "}
                      <span className="text-xs text-slate-500">
                        <LocalTime value={t.at} />
                      </span>
                    </p>
                  </li>
                ),
              )}
            </ol>
            {can.comment(role) && (
              <div className="mt-6 border-t border-slate-200 pt-4">
                <CommentForm incidentId={inc.id} />
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          {steps.length > 0 && (
            <Card title="Suggested next steps">
              <ol className="space-y-2.5 text-sm">
                {steps.map((st) => (
                  <li key={st.key} className="flex gap-2">
                    <span className={cx("mt-1.5 h-2 w-2 shrink-0 rounded-full", st.priority === "high" ? "bg-amber-500" : "bg-slate-300")} aria-hidden />
                    <span className="text-slate-800">
                      {st.priority === "high" && <span className="sr-only">Important: </span>}
                      {st.text}
                    </span>
                  </li>
                ))}
              </ol>
              <p className="mt-3 text-xs text-slate-500">Based on standard receiving practice. Suggestions only: nothing is changed or sent automatically.</p>
              {inc.suppliers && (
                <Link href={`/reports/supplier/${inc.supplier_id}`} className="mt-2 inline-block text-sm font-medium text-brand-600 hover:underline">
                  Draft a discrepancy report for {inc.suppliers.name}
                </Link>
              )}
            </Card>
          )}
          <Card title="Status and resolution">
            {mayUpdate ? (
              <StatusForm incidentId={inc.id} status={inc.status} resolutionNotes={inc.resolution_notes} canClose={can.closeIncident(role)} />
            ) : (
              <p className="text-sm text-slate-600">
                Only supervisors, the reporter or the assigned employee can update this incident.
              </p>
            )}
          </Card>
          {can.assign(role) && (
            <Card title="Assignment">
              <AssignForm incidentId={inc.id} assignedTo={inc.assigned_to} members={members.filter((m) => m.role !== "viewer")} />
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
