import type { Metadata } from "next";
import { Card, PageHeader, cx } from "@/components/ui";
import { requireAppContext } from "@/lib/context";
import { can } from "@/lib/permissions";
import { setFacilityActive } from "../actions";
import { EditFacility, FacilityForm } from "../SettingsForms";

export const metadata: Metadata = { title: "Facilities" };

export default async function FacilitiesPage() {
  const ctx = await requireAppContext();
  const manage = can.manageFacilities(ctx.org.role);
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader title="Facilities" description="Warehouses, distribution centers and plants where receiving happens." />
      {manage && (
        <Card title="Add a facility">
          <FacilityForm />
        </Card>
      )}
      <Card title={`${ctx.facilities.length} facilit${ctx.facilities.length === 1 ? "y" : "ies"}`}>
        {ctx.facilities.length === 0 ? (
          <p className="text-sm text-slate-500">No facilities yet.</p>
        ) : (
          <ul className="-my-2 divide-y divide-slate-100">
            {ctx.facilities.map((f) => (
              <li key={f.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
                <div className="min-w-0 flex-1">
                  <p className={cx("font-medium", f.is_active ? "text-slate-900" : "text-slate-400 line-through")}>
                    {f.name} {f.code && <span className="ml-1 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-600">{f.code}</span>}
                  </p>
                  <p className="text-sm text-slate-500">{f.address || "No address"}{!f.is_active && " · Inactive"}</p>
                </div>
                {manage && (
                  <div className="flex items-center gap-1">
                    <form action={setFacilityActive}>
                      <input type="hidden" name="facilityId" value={f.id} />
                      <input type="hidden" name="active" value={String(!f.is_active)} />
                      <button className="rounded-md px-2.5 py-1.5 text-sm text-slate-700 hover:bg-slate-100">{f.is_active ? "Deactivate" : "Reactivate"}</button>
                    </form>
                    <EditFacility facility={f} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        {!manage && <p className="mt-4 text-xs text-slate-500">Only managers, admins and owners can change facilities.</p>}
      </Card>
    </div>
  );
}
