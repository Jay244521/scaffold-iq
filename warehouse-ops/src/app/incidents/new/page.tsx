import Link from "next/link";
import type { Metadata } from "next";
import { Alert, PageHeader } from "@/components/ui";
import { requireAppContext } from "@/lib/context";
import { can } from "@/lib/permissions";
import { IncidentForm } from "./IncidentForm";

export const metadata: Metadata = { title: "Report exception" };

export default async function NewIncidentPage() {
  const ctx = await requireAppContext();
  const facilities = ctx.facilities.filter((f) => f.is_active).map((f) => ({ id: f.id, name: f.name }));

  if (!can.createIncident(ctx.org.role)) {
    return (
      <>
        <PageHeader title="Report a receiving exception" />
        <Alert tone="info">Your role ({ctx.org.role}) has read-only access. Ask an admin for operator access to report exceptions.</Alert>
      </>
    );
  }
  if (facilities.length === 0) {
    return (
      <>
        <PageHeader title="Report a receiving exception" />
        <Alert tone="warning">
          Add a facility first.{" "}
          {can.manageFacilities(ctx.org.role) && (
            <Link href="/settings/facilities" className="font-medium underline">
              Add a facility
            </Link>
          )}
        </Alert>
      </>
    );
  }

  const { data: suppliers } = await ctx.supabase.from("suppliers").select("name").eq("org_id", ctx.org.orgId).order("name").limit(500);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Report a receiving exception" description="Fields marked * are required. Everything else helps resolve it faster." />
      <IncidentForm facilities={facilities} defaultFacilityId={ctx.facility?.id ?? null} suppliers={(suppliers ?? []).map((s) => s.name as string)} />
    </div>
  );
}
