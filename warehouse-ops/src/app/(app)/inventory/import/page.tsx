import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { Alert, PageHeader } from "@/components/ui";
import { requireAppContext } from "@/lib/context";
import { can } from "@/lib/permissions";
import { ImportWizard } from "./ImportWizard";

export const metadata: Metadata = { title: "Import inventory file" };

export default async function ImportPage() {
  const ctx = await requireAppContext();
  const facilities = ctx.facilities.filter((f) => f.is_active).map((f) => ({ id: f.id, name: f.name }));
  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/inventory" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Inventory
      </Link>
      <PageHeader title="Import an inventory file" description="Upload a physical count or a WMS/ERP export. You'll see a preview and every difference before anything is saved." />
      {!can.importInventory(ctx.org.role) ? (
        <Alert tone="info">Your role has read-only access. Ask an admin for operator access to upload inventory files.</Alert>
      ) : facilities.length === 0 ? (
        <Alert tone="warning">Add a facility first (Settings → Facilities).</Alert>
      ) : (
        <ImportWizard facilities={facilities} defaultFacilityId={ctx.facility?.id ?? null} />
      )}
    </div>
  );
}
