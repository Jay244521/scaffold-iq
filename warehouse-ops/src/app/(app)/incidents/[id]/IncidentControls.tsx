"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Upload } from "lucide-react";
import { SubmitButton, useFormAction } from "@/components/client";
import { Alert, Field, buttonClass, fieldAria } from "@/components/ui";
import { EVIDENCE_ACCEPT } from "@/lib/evidence";
import { STATUS_LABELS, STATUSES, type IncidentStatus } from "@/lib/labels";
import type { ActionState } from "@/lib/validation";
import { addComment, assignIncident, updateStatus } from "../actions";
import { precheckFiles, uploadEvidence } from "../upload";

export function StatusForm({
  incidentId,
  status,
  resolutionNotes,
  canClose,
}: {
  incidentId: string;
  status: IncidentStatus;
  resolutionNotes: string | null;
  canClose: boolean;
}) {
  const [state, action, pending] = useFormAction(updateStatus, {} as ActionState);
  const [value, setValue] = useState<IncidentStatus>(status);
  useEffect(() => setValue(status), [status]);
  const fe = state.fieldErrors ?? {};
  const options = STATUSES.filter((s) => canClose || (s !== "closed" && status !== "closed") || s === status);
  const needsNotes = value === "resolved" || value === "closed";
  return (
    <form onSubmit={action} className="space-y-3">
      {state.error && <Alert>{state.error}</Alert>}
      {state.success && <Alert tone="success">{state.success}</Alert>}
      <input type="hidden" name="incidentId" value={incidentId} />
      <Field label="Status" name="status" error={fe.status}>
        <select {...fieldAria("status", fe.status)} value={value} onChange={(e) => setValue(e.target.value as IncidentStatus)} className="input" disabled={!canClose && status === "closed"}>
          {options.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Resolution notes" name="resolutionNotes" error={fe.resolutionNotes} required={needsNotes} hint="Required to resolve or close. e.g. supplier credit issued, replacement shipped.">
        <textarea {...fieldAria("resolutionNotes", fe.resolutionNotes)} defaultValue={resolutionNotes ?? ""} key={resolutionNotes ?? ""} rows={3} maxLength={5000} className="input" />
      </Field>
      <SubmitButton pending={pending} size="sm" pendingText="Updating…">
        Save status
      </SubmitButton>
    </form>
  );
}

export function AssignForm({ incidentId, assignedTo, members }: { incidentId: string; assignedTo: string | null; members: { userId: string; name: string }[] }) {
  const [state, action, pending] = useFormAction(assignIncident, {} as ActionState);
  return (
    <form onSubmit={action} className="space-y-3">
      {state.error && <Alert>{state.error}</Alert>}
      {state.success && <Alert tone="success">{state.success}</Alert>}
      <input type="hidden" name="incidentId" value={incidentId} />
      <Field label="Responsible employee" name="assigneeId">
        <select id="assigneeId" name="assigneeId" defaultValue={assignedTo ?? ""} key={assignedTo ?? ""} className="input">
          <option value="">Unassigned</option>
          {members.map((m) => (
            <option key={m.userId} value={m.userId}>
              {m.name}
            </option>
          ))}
        </select>
      </Field>
      <SubmitButton pending={pending} size="sm" variant="secondary" pendingText="Saving…">
        Save assignment
      </SubmitButton>
    </form>
  );
}

export function CommentForm({ incidentId }: { incidentId: string }) {
  const [state, action, pending] = useFormAction(addComment, {} as ActionState);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.success) ref.current?.reset();
  }, [state]);
  const fe = state.fieldErrors ?? {};
  return (
    <form ref={ref} onSubmit={action} className="space-y-2">
      {state.error && <Alert>{state.error}</Alert>}
      <input type="hidden" name="incidentId" value={incidentId} />
      <Field label="Add an internal comment" name="body" error={fe.body} hint="Visible only to your team.">
        <textarea {...fieldAria("body", fe.body)} rows={3} maxLength={4000} className="input" required />
      </Field>
      <SubmitButton pending={pending} size="sm" pendingText="Posting…">
        Post comment
      </SubmitButton>
    </form>
  );
}

export function EvidenceUploader({ orgId, incidentId }: { orgId: string; incidentId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [done, setDone] = useState<string | null>(null);

  async function onFiles(list: FileList | null) {
    const files = Array.from(list ?? []);
    if (!files.length) return;
    setDone(null);
    const problems = precheckFiles(files);
    setErrors(problems);
    if (problems.length) return;
    setBusy(`Uploading 0/${files.length}…`);
    const res = await uploadEvidence(orgId, incidentId, files, (n) => setBusy(`Uploading ${n}/${files.length}…`));
    setErrors(res.errors);
    setBusy(null);
    if (res.uploaded) setDone(`${res.uploaded} file${res.uploaded === 1 ? "" : "s"} added.`);
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <label className={buttonClass("secondary", "sm", busy ? "pointer-events-none opacity-60" : "cursor-pointer")}>
        <Upload className="h-4 w-4" aria-hidden /> {busy ?? "Add photos or documents"}
        <input type="file" multiple accept={EVIDENCE_ACCEPT} className="sr-only" disabled={Boolean(busy)} onChange={(e) => (onFiles(e.target.files), (e.target.value = ""))} />
      </label>
      {done && <Alert tone="success">{done}</Alert>}
      {errors.length > 0 && (
        <Alert>
          <ul className="list-disc pl-4">
            {errors.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </Alert>
      )}
    </div>
  );
}
