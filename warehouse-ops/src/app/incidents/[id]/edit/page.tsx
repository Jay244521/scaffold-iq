import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";
import { Alert, PageHeader } from "@/components/ui";
import { requireAppContext } from "@/lib/context";
import { incidentRef, type ExceptionType } from "@/lib/labels";
import { can } from "@/lib/permissions";
import { IncidentForm } from "../../new/IncidentForm";

export const metadata: Metadata = { title: "Edit incident" };

export default async function EditIncidentPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAppContext();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { data: inc } = await ctx.supabase
    .from("incidents")
    .select("id, number, type, facility_id, po_number, shipment_ref, sku, item_description, expected_qty, received_qty, description, occurred_at, suppliers(name)")
    .eq("id", id)
    .eq("org_id", ctx.org.orgId)
    .maybeSingle();
  if (!inc) notFound();

  const back = (
    <Link href={`/incidents/${id}`} className="mb-4 inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900">
      <ArrowLeft className="h-4 w-4" aria-hidden /> Back to {incidentRef(inc.number as number)}
    </Link>
  );
  if (!can.editIncidentDetails(ctx.org.role)) {
    return (
      <>
        {back}
        <Alert tone="info">Only supervisors, managers, admins and owners can edit incident details.</Alert>
      </>
    );
  }

  const { data: suppliers } = await ctx.supabase.from("suppliers").select("name").eq("org_id", ctx.org.orgId).order("name").limit(500);
  // Include the current facility even if it has since been deactivated.
  const facilities = ctx.facilities.filter((f) => f.is_active || f.id === inc.facility_id).map((f) => ({ id: f.id, name: f.name }));
  const supplier = inc.suppliers as unknown as { name: string } | null;

  return (
    <div className="mx-auto max-w-3xl">
      {back}
      <PageHeader title={`Edit ${incidentRef(inc.number as number)}`} description="Corrections are recorded in the incident's history." />
      <IncidentForm
        facilities={facilities}
        defaultFacilityId={inc.facility_id as string}
        suppliers={(suppliers ?? []).map((s) => s.name as string)}
        initial={{
          id: inc.id as string,
          type: inc.type as ExceptionType,
          facilityId: inc.facility_id as string,
          supplierName: supplier?.name ?? null,
          poNumber: inc.po_number as string | null,
          shipmentRef: inc.shipment_ref as string | null,
          sku: inc.sku as string | null,
          itemDescription: inc.item_description as string | null,
          expectedQty: inc.expected_qty as number | null,
          receivedQty: inc.received_qty as number | null,
          description: inc.description as string,
          occurredAt: inc.occurred_at as string,
        }}
      />
    </div>
  );
}
