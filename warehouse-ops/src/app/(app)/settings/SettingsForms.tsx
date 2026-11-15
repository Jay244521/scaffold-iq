"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { SubmitButton, useFormAction } from "@/components/client";
import { Alert, Field, buttonClass, fieldAria } from "@/components/ui";
import { ROLE_LABELS, type Role } from "@/lib/permissions";
import type { ActionState } from "@/lib/validation";
import { changeRole, createFacility, inviteMember, removeMember, updateFacility, type InviteState } from "./actions";

type FacilityValues = { id?: string; name?: string; code?: string | null; address?: string | null };

export function FacilityForm({ facility, onDone }: { facility?: FacilityValues; onDone?: () => void }) {
  const [state, action, pending] = useFormAction(facility?.id ? updateFacility : createFacility, {} as ActionState);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.success) {
      if (!facility?.id) ref.current?.reset();
      onDone?.();
    }
  }, [state, facility?.id, onDone]);
  const fe = state.fieldErrors ?? {};
  const p = facility?.id ? `f-${facility.id}-` : "new-";
  return (
    <form ref={ref} onSubmit={action} className="grid gap-3 sm:grid-cols-6" noValidate>
      {facility?.id && <input type="hidden" name="facilityId" value={facility.id} />}
      <div className="sm:col-span-6">
        {state.error && <Alert>{state.error}</Alert>}
        {state.success && !facility?.id && <Alert tone="success">{state.success}</Alert>}
      </div>
      <Field label="Facility name" name={`${p}name`} error={fe.name} required className="sm:col-span-2">
        <input {...fieldAria(`${p}name`, fe.name)} name="name" defaultValue={facility?.name} className="input" required maxLength={120} />
      </Field>
      <Field label="Code" name={`${p}code`} error={fe.code} hint="Optional, e.g. DAL1" className="sm:col-span-1">
        <input {...fieldAria(`${p}code`, fe.code)} name="code" defaultValue={facility?.code ?? ""} className="input" maxLength={16} />
      </Field>
      <Field label="Address" name={`${p}address`} error={fe.address} className="sm:col-span-3">
        <input {...fieldAria(`${p}address`, fe.address)} name="address" defaultValue={facility?.address ?? ""} className="input" maxLength={300} />
      </Field>
      <div className="flex gap-2 sm:col-span-6">
        <SubmitButton pending={pending} size="sm">{facility?.id ? "Save changes" : "Add facility"}</SubmitButton>
        {onDone && facility?.id && (
          <button type="button" onClick={onDone} className={buttonClass("ghost", "sm")}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

export function EditFacility({ facility }: { facility: FacilityValues }) {
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className={buttonClass("ghost", "sm")}>
        Edit
      </button>
    );
  return (
    <div className="mt-3 w-full rounded-md border border-slate-200 bg-slate-50 p-3">
      <FacilityForm facility={facility} onDone={() => setOpen(false)} />
    </div>
  );
}

export function InviteForm({ roles }: { roles: Role[] }) {
  const [state, action, pending] = useFormAction(inviteMember, {} as InviteState);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.link) {
      ref.current?.reset();
      setCopied(false);
    }
  }, [state]);
  const fe = state.fieldErrors ?? {};
  return (
    <div className="space-y-4">
      <form ref={ref} onSubmit={action} className="grid gap-3 sm:grid-cols-[1fr_12rem_auto] sm:items-end" noValidate>
        <Field label="Email address" name="email" error={fe.email}>
          <input {...fieldAria("email", fe.email)} type="email" className="input" placeholder="name@company.com" required />
        </Field>
        <Field label="Role" name="role" error={fe.role}>
          <select {...fieldAria("role", fe.role)} defaultValue="operator" className="input">
            {roles.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </Field>
        <SubmitButton pending={pending} pendingText="Creating…">Create invitation</SubmitButton>
      </form>
      {state.error && <Alert>{state.error}</Alert>}
      {state.link && (
        <Alert tone="success">
          <p>
            Invitation for <strong>{state.email}</strong> created. Send them this link (it works once, for that email, for 7 days). It won't be shown again.
          </p>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input readOnly value={state.link} className="input !bg-white font-mono !text-xs" onFocus={(e) => e.currentTarget.select()} aria-label="Invitation link" />
            <button
              type="button"
              className={buttonClass("secondary", "sm")}
              onClick={async () => {
                await navigator.clipboard.writeText(state.link!);
                setCopied(true);
              }}
            >
              {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />} {copied ? "Copied" : "Copy link"}
            </button>
          </div>
        </Alert>
      )}
    </div>
  );
}

export function RoleSelect({ userId, role, roles, disabled }: { userId: string; role: Role; roles: Role[]; disabled?: boolean }) {
  const [state, action, pending] = useFormAction(changeRole, {} as ActionState);
  return (
    <form onSubmit={action} className="flex flex-col items-start gap-1">
      <input type="hidden" name="userId" value={userId} />
      <div className="flex gap-2">
        <label className="sr-only" htmlFor={`role-${userId}`}>
          Role
        </label>
        <select id={`role-${userId}`} name="role" defaultValue={role} disabled={disabled} className="input !w-auto !py-1 !text-sm">
          {(roles.includes(role) ? roles : [role, ...roles]).map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
        {!disabled && (
          <SubmitButton pending={pending} size="sm" variant="secondary" pendingText="…">
            Save
          </SubmitButton>
        )}
      </div>
      {state.error && <p className="text-xs text-red-700">{state.error}</p>}
      {state.success && <p className="text-xs text-emerald-700">Saved</p>}
    </form>
  );
}

export function RemoveMemberButton({ userId, label, self }: { userId: string; label: string; self?: boolean }) {
  const [state, action, pending] = useFormAction(removeMember, {} as ActionState);
  return (
    <form
      onSubmit={(e) => {
        if (!confirm(self ? "Leave this organization? You'll lose access immediately." : `Remove ${label} from the organization?`)) return e.preventDefault();
        action(e);
      }}
    >
      <input type="hidden" name="userId" value={userId} />
      <button className="text-sm text-red-700 hover:underline">{self ? "Leave" : "Remove"}</button>
      {state.error && <p className="text-xs text-red-700">{state.error}</p>}
    </form>
  );
}
