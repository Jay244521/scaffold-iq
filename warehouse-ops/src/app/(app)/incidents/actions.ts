"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getMembers, requireAppContext } from "@/lib/context";
import { EVIDENCE_BUCKET } from "@/lib/env";
import { friendlyError, logError } from "@/lib/errors";
import { checkEvidenceFile, isEvidenceKind, sameEvidenceFamily, sniffEvidenceType } from "@/lib/evidence";
import { can, canUpdateIncident, type Role } from "@/lib/permissions";
import {
  assignSchema,
  commentSchema,
  fieldErrorsOf,
  formToObject,
  incidentSchema,
  statusSchema,
  type ActionState,
} from "@/lib/validation";

type IncidentAccess = { id: string; org_id: string; status: string; reported_by: string | null; assigned_to: string | null };

/** Loads an incident only if it belongs to the active organization (RLS also enforces membership). */
async function loadIncident(supabase: SupabaseClient, orgId: string, incidentId: unknown): Promise<IncidentAccess | null> {
  const id = z.uuid().safeParse(incidentId);
  if (!id.success) return null;
  const { data } = await supabase
    .from("incidents")
    .select("id, org_id, status, reported_by, assigned_to")
    .eq("id", id.data)
    .eq("org_id", orgId)
    .maybeSingle();
  return (data as IncidentAccess) ?? null;
}

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

async function findOrCreateSupplier(supabase: SupabaseClient, orgId: string, name: string): Promise<string | null> {
  const find = () =>
    supabase.from("suppliers").select("id").eq("org_id", orgId).ilike("name", escapeLike(name)).limit(1).maybeSingle();
  const existing = await find();
  if (existing.data) return existing.data.id as string;
  const { data, error } = await supabase.from("suppliers").insert({ org_id: orgId, name }).select("id").single();
  if (data) return data.id as string;
  if (error?.code === "23505") return ((await find()).data?.id as string) ?? null;
  logError("create supplier", error);
  return null;
}

export type CreateIncidentResult = ActionState & { incidentId?: string; orgId?: string };

/** Creates the incident record. Evidence files are uploaded afterwards by the browser. */
export async function createIncident(formData: FormData): Promise<CreateIncidentResult> {
  const ctx = await requireAppContext();
  if (!can.createIncident(ctx.org.role)) return { error: "Your role can't report incidents. Ask an admin for operator access." };

  const parsed = incidentSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error), error: "Please fix the highlighted fields." };
  const v = parsed.data;

  // The facility id from the form is only accepted if it is an active facility of this organization.
  if (!ctx.facilities.some((f) => f.id === v.facilityId && f.is_active)) {
    return { fieldErrors: { facilityId: ["Choose one of your facilities"] } };
  }

  let supplierId: string | null = null;
  if (v.supplierName) {
    supplierId = await findOrCreateSupplier(ctx.supabase, ctx.org.orgId, v.supplierName);
    if (!supplierId) return { error: "We couldn't save the supplier. Please try again." };
  }

  const { data, error } = await ctx.supabase
    .from("incidents")
    .insert({
      org_id: ctx.org.orgId,
      facility_id: v.facilityId,
      type: v.type,
      supplier_id: supplierId,
      po_number: v.poNumber ?? null,
      shipment_ref: v.shipmentRef ?? null,
      sku: v.sku ?? null,
      item_description: v.itemDescription ?? null,
      expected_qty: v.expectedQty,
      received_qty: v.receivedQty,
      description: v.description,
      occurred_at: v.occurredAt,
    })
    .select("id")
    .single();
  if (error || !data) {
    logError("create incident", error);
    return { error: friendlyError(error) };
  }
  revalidatePath("/dashboard");
  revalidatePath("/incidents");
  return { incidentId: data.id as string, orgId: ctx.org.orgId };
}

/**
 * Called after the browser uploads a file straight to private storage. Confirms the
 * file sits in this incident's folder, checks its size and real type (first bytes),
 * then records it. Files that fail are deleted.
 */
export async function registerEvidence(
  incidentId: string,
  path: string,
  originalName: string,
  kind: string = "evidence",
): Promise<ActionState> {
  const ctx = await requireAppContext();
  if (!isEvidenceKind(kind)) return { error: "Invalid evidence type." };
  if (!can.uploadEvidence(ctx.org.role)) return { error: "Your role can't add evidence." };
  const incident = await loadIncident(ctx.supabase, ctx.org.orgId, incidentId);
  if (!incident) return { error: "Incident not found." };

  const folder = `${incident.org_id}/${incident.id}`;
  const objectName = typeof path === "string" && path.startsWith(`${folder}/`) ? path.slice(folder.length + 1) : "";
  if (!objectName || objectName.includes("/") || path.length > 400) return { error: "Invalid file location." };

  const storage = ctx.supabase.storage.from(EVIDENCE_BUCKET);
  const reject = async (message: string) => {
    await storage.remove([path]);
    return { error: message };
  };

  const { data: listing, error: listError } = await storage.list(folder, { search: objectName, limit: 5 });
  const object = listing?.find((o) => o.name === objectName);
  if (listError || !object) return { error: "The uploaded file could not be found. Please try again." };
  const size = Number(object.metadata?.size ?? 0);
  const storedType = String(object.metadata?.mimetype ?? "");
  const displayName = String(originalName ?? "file").replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 200) || "file";

  const check = checkEvidenceFile(displayName, storedType, size);
  if (!check.ok) return reject(check.error);

  // Read the first bytes to confirm the file really is what it claims to be.
  const { data: signed } = await storage.createSignedUrl(path, 60);
  let head = new Uint8Array();
  if (signed?.signedUrl) {
    try {
      const res = await fetch(signed.signedUrl, { headers: { Range: "bytes=0-31" }, cache: "no-store" });
      if (res.ok) head = new Uint8Array(await res.arrayBuffer()).slice(0, 32);
    } catch (e) {
      logError("evidence sniff", e);
    }
  }
  const actualType = sniffEvidenceType(head);
  if (!actualType || !sameEvidenceFamily(actualType, storedType)) {
    return reject(`${displayName}: the file contents don't match an allowed photo or PDF type.`);
  }

  const { error } = await ctx.supabase.from("incident_attachments").insert({
    org_id: incident.org_id,
    incident_id: incident.id,
    storage_path: path,
    file_name: displayName,
    mime_type: actualType,
    size_bytes: size,
    kind,
  });
  if (error) {
    logError("register evidence", error);
    return reject(friendlyError(error));
  }
  revalidatePath(`/incidents/${incident.id}`);
  return { success: "uploaded" };
}

/** Supervisors and above correct an incident's details. History records which fields changed. */
export async function updateIncidentDetails(incidentId: string, formData: FormData): Promise<ActionState> {
  const ctx = await requireAppContext();
  if (!can.editIncidentDetails(ctx.org.role)) return { error: "Only supervisors and above can edit incident details." };
  const incident = await loadIncident(ctx.supabase, ctx.org.orgId, incidentId);
  if (!incident) return { error: "Incident not found." };

  const parsed = incidentSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error), error: "Please fix the highlighted fields." };
  const v = parsed.data;
  if (!ctx.facilities.some((f) => f.id === v.facilityId)) return { fieldErrors: { facilityId: ["Choose one of your facilities"] } };

  let supplierId: string | null = null;
  if (v.supplierName) {
    supplierId = await findOrCreateSupplier(ctx.supabase, ctx.org.orgId, v.supplierName);
    if (!supplierId) return { error: "We couldn't save the supplier. Please try again." };
  }
  const { data, error } = await ctx.supabase
    .from("incidents")
    .update({
      facility_id: v.facilityId,
      type: v.type,
      supplier_id: supplierId,
      po_number: v.poNumber ?? null,
      shipment_ref: v.shipmentRef ?? null,
      sku: v.sku ?? null,
      item_description: v.itemDescription ?? null,
      expected_qty: v.expectedQty,
      received_qty: v.receivedQty,
      description: v.description,
      occurred_at: v.occurredAt,
    })
    .eq("id", incident.id)
    .eq("org_id", ctx.org.orgId)
    .select("id");
  if (error) {
    logError("update incident details", error);
    return { error: friendlyError(error) };
  }
  if (!data?.length) return { error: "You don't have permission to edit this incident." };
  revalidatePath(`/incidents/${incident.id}`);
  revalidatePath("/incidents");
  revalidatePath("/dashboard");
  return { success: "Saved." };
}

export async function deleteEvidence(formData: FormData) {
  const ctx = await requireAppContext();
  if (!can.deleteEvidence(ctx.org.role)) return;
  const id = z.uuid().safeParse(formData.get("attachmentId"));
  if (!id.success) return;
  const { data: row } = await ctx.supabase
    .from("incident_attachments")
    .select("id, incident_id, storage_path")
    .eq("id", id.data)
    .eq("org_id", ctx.org.orgId)
    .maybeSingle();
  if (!row) return;
  const { error } = await ctx.supabase.from("incident_attachments").delete().eq("id", row.id);
  if (error) return logError("delete evidence row", error);
  await ctx.supabase.storage.from(EVIDENCE_BUCKET).remove([row.storage_path as string]);
  revalidatePath(`/incidents/${row.incident_id}`);
}

export async function updateStatus(_: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await requireAppContext();
  const incident = await loadIncident(ctx.supabase, ctx.org.orgId, formData.get("incidentId"));
  if (!incident) return { error: "Incident not found." };
  if (!canUpdateIncident(ctx.org.role, ctx.user.id, incident)) return { error: "You don't have permission to update this incident." };

  const parsed = statusSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };
  const touchesClosed = parsed.data.status === "closed" || incident.status === "closed";
  if (touchesClosed && parsed.data.status !== incident.status && !can.closeIncident(ctx.org.role)) {
    return { error: "Only supervisors and above can close or reopen closed incidents." };
  }

  const { data, error } = await ctx.supabase
    .from("incidents")
    .update({ status: parsed.data.status, resolution_notes: parsed.data.resolutionNotes ?? null })
    .eq("id", incident.id)
    .eq("org_id", ctx.org.orgId)
    .select("id");
  if (error) return { error: friendlyError(error) };
  if (!data?.length) return { error: "You don't have permission to update this incident." };
  revalidatePath(`/incidents/${incident.id}`);
  revalidatePath("/dashboard");
  return { success: "Status updated." };
}

export async function assignIncident(_: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await requireAppContext();
  if (!can.assign(ctx.org.role)) return { error: "Only supervisors and above can assign incidents." };
  const incident = await loadIncident(ctx.supabase, ctx.org.orgId, formData.get("incidentId"));
  if (!incident) return { error: "Incident not found." };
  const parsed = assignSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };

  const assignee = parsed.data.assigneeId ?? null;
  if (assignee && !(await getMembers(ctx.org.orgId)).some((m) => m.userId === assignee)) {
    return { error: "Choose a member of your team." };
  }
  const { error } = await ctx.supabase.from("incidents").update({ assigned_to: assignee }).eq("id", incident.id).eq("org_id", ctx.org.orgId);
  if (error) return { error: friendlyError(error) };
  revalidatePath(`/incidents/${incident.id}`);
  return { success: assignee ? "Incident assigned." : "Assignment removed." };
}

export async function addComment(_: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await requireAppContext();
  if (!can.comment(ctx.org.role as Role)) return { error: "Your role can't add comments." };
  const incident = await loadIncident(ctx.supabase, ctx.org.orgId, formData.get("incidentId"));
  if (!incident) return { error: "Incident not found." };
  const parsed = commentSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };

  const { error } = await ctx.supabase
    .from("incident_comments")
    .insert({ org_id: incident.org_id, incident_id: incident.id, body: parsed.data.body });
  if (error) return { error: friendlyError(error) };
  revalidatePath(`/incidents/${incident.id}`);
  return { success: "Comment added." };
}
