import Link from "next/link";
import type { Metadata } from "next";
import { LocalTime } from "@/components/client";
import { Alert, Card, PageHeader } from "@/components/ui";
import { requireAppContext } from "@/lib/context";
import { can } from "@/lib/permissions";
import { SupplierControls } from "./SupplierRow";

export const metadata: Metadata = { title: "Suppliers" };

type Row = { id: string; name: string; created_at: string; incidents: { count: number }[] };

export default async function SuppliersPage({ searchParams }: { searchParams: Promise<{ merged?: string }> }) {
  const ctx = await requireAppContext();
  const { merged } = await searchParams;
  const moved = merged !== undefined ? Math.max(0, Number(merged) || 0) : null;
  const manage = can.manageFacilities(ctx.org.role);
  const { data } = await ctx.supabase.from("suppliers").select("id, name, created_at, incidents(count)").eq("org_id", ctx.org.orgId).order("name").limit(1000);
  const rows = (data ?? []) as unknown as Row[];
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Suppliers"
        description="Suppliers are added automatically when someone reports an exception. Rename them, or merge duplicates so reports and patterns stay accurate."
      />
      {moved !== null && (
        <Alert tone="success">Suppliers merged. {moved} incident{moved === 1 ? "" : "s"} moved to the surviving supplier. The change is recorded in each incident&apos;s history and the audit log.</Alert>
      )}
      <Card title={`${rows.length} supplier${rows.length === 1 ? "" : "s"}`}>
        {rows.length === 0 ? (
          <p className="text-sm text-slate-500">No suppliers yet.</p>
        ) : (
          <ul className="-my-2 divide-y divide-slate-100">
            {rows.map((r) => {
              const count = r.incidents?.[0]?.count ?? 0;
              return (
                <li key={r.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900">{r.name}</p>
                    <p className="text-xs text-slate-500">
                      <Link href={`/incidents?supplier=${r.id}`} className="hover:underline">{count} incident{count === 1 ? "" : "s"}</Link>
                      {count > 0 && (
                        <> · <Link href={`/reports/supplier/${r.id}`} className="text-brand-600 hover:underline">Report</Link></>
                      )}{" "}
                      · added <LocalTime value={r.created_at} mode="date" />
                    </p>
                  </div>
                  {manage && <SupplierControls id={r.id} name={r.name} others={rows.filter((o) => o.id !== r.id).map((o) => ({ id: o.id, name: o.name }))} />}
                </li>
              );
            })}
          </ul>
        )}
        {!manage && <p className="mt-4 text-xs text-slate-500">Managers, admins and owners can rename and merge suppliers.</p>}
      </Card>
    </div>
  );
}
