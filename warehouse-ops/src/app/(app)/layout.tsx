import Link from "next/link";
import { LogOut } from "lucide-react";
import { AutoSubmitSelect } from "@/components/client";
import { Logo } from "@/components/Logo";
import { requireAppContext } from "@/lib/context";
import { ROLE_LABELS, can } from "@/lib/permissions";
import { logOut } from "@/app/(auth)/actions";
import { switchFacility, switchOrganization } from "./context-actions";
import { MobileNav, Sidebar } from "./AppNav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireAppContext();
  const activeFacilities = ctx.facilities.filter((f) => f.is_active);
  const name = ctx.profile.full_name || ctx.profile.email;

  const header = (
    <Link href="/dashboard" className="text-white">
      <Logo />
    </Link>
  );
  const footer = (
    <div className="space-y-3 px-2 text-sm">
      {ctx.memberships.length > 1 && (
        <form action={switchOrganization}>
          <label htmlFor="orgId" className="mb-1 block text-xs text-slate-400">
            Company
          </label>
          <AutoSubmitSelect key={ctx.org.orgId} id="orgId" name="orgId" defaultValue={ctx.org.orgId} className="input !py-1.5 !text-sm">
            {ctx.memberships.map((m) => (
              <option key={m.orgId} value={m.orgId}>
                {m.orgName}
              </option>
            ))}
          </AutoSubmitSelect>
          <noscript>
            <button className="mt-1 text-xs text-white underline">Switch</button>
          </noscript>
        </form>
      )}
      <div className="text-slate-300">
        <p className="truncate font-medium text-white" title={name}>
          {name}
        </p>
        <p className="text-xs text-slate-400">
          {ROLE_LABELS[ctx.org.role]} · {ctx.org.orgName}
        </p>
      </div>
      <div className="flex items-center justify-between">
        <Link href="/onboarding?new=1" className="text-xs text-slate-400 hover:text-white">
          + New company
        </Link>
        <form action={logOut}>
          <button className="inline-flex items-center gap-1.5 text-xs text-slate-300 hover:text-white">
            <LogOut className="h-3.5 w-3.5" aria-hidden /> Log out
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <Sidebar canReport={can.createIncident(ctx.org.role)} header={header} footer={footer} />
      <MobileNav canReport={can.createIncident(ctx.org.role)} header={header} footer={footer} />
      <div className="min-w-0 flex-1 overflow-x-clip">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-2.5 sm:px-6">
          <p className="truncate text-sm font-medium text-slate-900">{ctx.org.orgName}</p>
          <form action={switchFacility} className="flex items-center gap-2">
            <label htmlFor="facilityId" className="text-sm text-slate-600">
              Facility
            </label>
            <AutoSubmitSelect key={ctx.facility?.id ?? "all"} id="facilityId" name="facilityId" defaultValue={ctx.facility?.id ?? "all"} className="input !w-auto !py-1.5 !text-sm">
              <option value="all">All facilities</option>
              {activeFacilities.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </AutoSubmitSelect>
            <noscript>
              <button className="text-sm underline">Apply</button>
            </noscript>
          </form>
        </div>
        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
