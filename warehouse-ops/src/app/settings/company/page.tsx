import type { Metadata } from "next";
import { Card, PageHeader } from "@/components/ui";
import { requireAppContext } from "@/lib/context";
import { can } from "@/lib/permissions";
import { COMMON_TIMEZONES } from "@/lib/timezone";
import { CompanyForm } from "./CompanyForm";

export const metadata: Metadata = { title: "Company" };

export default async function CompanyPage() {
  const ctx = await requireAppContext();
  const all = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : COMMON_TIMEZONES;
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="Company" description="Name and time zone for your workspace." />
      <Card>
        <CompanyForm name={ctx.org.orgName} timezone={ctx.org.timezone} common={COMMON_TIMEZONES} all={[...all, "UTC"].filter((v, i, a) => a.indexOf(v) === i)} editable={can.manageTeam(ctx.org.role)} />
      </Card>
    </div>
  );
}
