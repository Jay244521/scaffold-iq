"use client";

import { SubmitButton, useFormAction } from "@/components/client";
import { Alert, Field } from "@/components/ui";
import type { ActionState } from "@/lib/validation";
import { updateCompany } from "./actions";

export function CompanyForm({ name, timezone, common, all, editable }: { name: string; timezone: string; common: string[]; all: string[]; editable: boolean }) {
  const [state, action, pending] = useFormAction(updateCompany, {} as ActionState);
  const label = (tz: string) => tz.replace(/_/g, " ");
  return (
    <form onSubmit={action} className="space-y-4">
      {state.error && <Alert>{state.error}</Alert>}
      {state.success && <Alert tone="success">{state.success}</Alert>}
      <Field label="Company name" name="name">
        <input id="name" name="name" defaultValue={name} className="input" maxLength={120} required disabled={!editable} />
      </Field>
      <Field label="Time zone" name="timezone" hint="Used for date filters, reports, supplier reports and CSV exports.">
        <select id="timezone" name="timezone" defaultValue={timezone} className="input" disabled={!editable}>
          <optgroup label="Common">
            {common.map((tz) => <option key={tz} value={tz}>{label(tz)}</option>)}
          </optgroup>
          <optgroup label="All time zones">
            {all.filter((tz) => !common.includes(tz)).map((tz) => <option key={tz} value={tz}>{label(tz)}</option>)}
          </optgroup>
        </select>
      </Field>
      {editable ? <SubmitButton pending={pending}>Save</SubmitButton> : <p className="text-xs text-slate-500">Only owners and admins can change these settings.</p>}
    </form>
  );
}
