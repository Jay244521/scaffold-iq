"use client";

import { SubmitButton, useFormAction } from "@/components/client";
import { Alert, Field, fieldAria } from "@/components/ui";
import type { ActionState } from "@/lib/validation";
import { createOrganization } from "./actions";

export function OnboardingForm() {
  const [state, action, pending] = useFormAction(createOrganization, {} as ActionState);
  const fe = state.fieldErrors ?? {};
  return (
    <form onSubmit={action} className="space-y-4" noValidate>
      {state.error && <Alert>{state.error}</Alert>}
      <Field label="Company name" name="name" error={fe.name} required>
        <input {...fieldAria("name", fe.name)} required className="input" placeholder="e.g. Lone Star Distribution" autoComplete="organization" />
      </Field>
      <Field label="First warehouse or facility" name="facilityName" error={fe.facilityName} hint="You can add more facilities later.">
        <input {...fieldAria("facilityName", fe.facilityName)} className="input" placeholder="e.g. Dallas DC" />
      </Field>
      <SubmitButton pending={pending} className="w-full" pendingText="Creating workspace…">
        Create workspace
      </SubmitButton>
    </form>
  );
}
