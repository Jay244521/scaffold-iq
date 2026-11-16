"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Camera, FileText, X } from "lucide-react";
import { Alert, Field, buttonClass, cx, fieldAria } from "@/components/ui";
import { EVIDENCE_ACCEPT } from "@/lib/evidence";
import { EXCEPTION_HINTS, EXCEPTION_LABELS, EXCEPTION_TYPES, formatBytes, formatQty, variance, type ExceptionType } from "@/lib/labels";
import type { FieldErrors } from "@/lib/validation";
import { createIncident, updateIncidentDetails } from "../actions";
import { precheckFiles, uploadEvidence } from "../upload";

export type IncidentInitial = {
  id: string;
  type: ExceptionType;
  facilityId: string;
  supplierName: string | null;
  poNumber: string | null;
  shipmentRef: string | null;
  sku: string | null;
  itemDescription: string | null;
  expectedQty: number | null;
  receivedQty: number | null;
  description: string;
  occurredAt: string;
};

type Props = {
  facilities: { id: string; name: string }[];
  defaultFacilityId: string | null;
  suppliers: string[];
  /** When set, the form edits this incident (no evidence upload; supervisors only). */
  initial?: IncidentInitial;
};

const toLocalInput = (d: Date) => {
  const off = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
};

export function IncidentForm({ facilities, defaultFacilityId, suppliers, initial }: Props) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [type, setType] = useState<ExceptionType | "">(initial?.type ?? "");
  const [expected, setExpected] = useState(initial?.expectedQty != null ? String(Number(initial.expectedQty)) : "");
  const [received, setReceived] = useState(initial?.receivedQty != null ? String(Number(initial.receivedQty)) : "");
  const [occurredAt, setOccurredAt] = useState("");
  const [maxDate, setMaxDate] = useState<string | undefined>();
  const [files, setFiles] = useState<File[]>([]);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [fileErrors, setFileErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    const now = new Date();
    setOccurredAt(toLocalInput(initial ? new Date(initial.occurredAt) : now));
    setMaxDate(toLocalInput(new Date(now.getTime() + 5 * 60_000)));
  }, [initial]);

  const diff = variance(expected === "" ? null : expected, received === "" ? null : received);
  const fe = fieldErrors;

  function addFiles(list: FileList | null) {
    const next = [...files, ...Array.from(list ?? [])];
    setFileErrors(precheckFiles(next));
    setFiles(next);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const problems = precheckFiles(files);
    setFileErrors(problems);
    if (problems.length) return;

    setError(null);
    setFieldErrors({});
    setBusy("Saving incident…");
    const fd = new FormData(e.currentTarget);
    fd.set("occurredAt", occurredAt ? new Date(occurredAt).toISOString() : "");

    try {
      if (initial) {
        const res = await updateIncidentDetails(initial.id, fd);
        if (res.error || res.fieldErrors) {
          setFieldErrors(res.fieldErrors ?? {});
          setError(res.error ?? "Please fix the highlighted fields.");
          setBusy(null);
          window.scrollTo({ top: 0, behavior: "smooth" });
          return;
        }
        router.push(`/incidents/${initial.id}?updated=1`);
        return;
      }
      const res = await createIncident(fd);
      if (!res.incidentId || !res.orgId) {
        setFieldErrors(res.fieldErrors ?? {});
        setError(res.error ?? "Please fix the highlighted fields.");
        setBusy(null);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      let failed = 0;
      if (files.length) {
        setBusy(`Uploading evidence (0/${files.length})…`);
        const up = await uploadEvidence(res.orgId, res.incidentId, files, (n) => setBusy(`Uploading evidence (${n}/${files.length})…`));
        failed = up.errors.length;
      }
      router.push(`/incidents/${res.incidentId}?created=1${failed ? `&failed=${failed}` : ""}`);
    } catch {
      setError("Connection problem. Your incident may not have been saved — check the incident list before retrying.");
      setBusy(null);
    }
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-6" noValidate>
      {error && <Alert>{error}</Alert>}

      <fieldset className="card p-4 sm:p-5">
        <legend className="sr-only">Exception type</legend>
        <p className="label">
          What happened? <span className="text-red-600">*</span>
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5" role="radiogroup" aria-describedby={fe.type ? "type-error" : undefined}>
          {EXCEPTION_TYPES.map((t) => (
            <label
              key={t}
              className={cx(
                "flex cursor-pointer flex-col rounded-md border px-3 py-2.5 text-sm has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-500",
                type === t ? "border-brand-600 bg-brand-50 ring-1 ring-brand-600" : "border-slate-300 bg-white hover:border-slate-400",
              )}
            >
              <input type="radio" name="type" value={t} checked={type === t} onChange={() => setType(t)} className="sr-only" />
              <span className="font-medium text-slate-900">{EXCEPTION_LABELS[t]}</span>
              <span className="text-xs text-slate-500">{EXCEPTION_HINTS[t]}</span>
            </label>
          ))}
        </div>
        {fe.type && (
          <p id="type-error" className="mt-2 text-sm text-red-700" role="alert">
            {fe.type[0]}
          </p>
        )}
      </fieldset>

      <div className="card grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
        <Field label="Facility" name="facilityId" error={fe.facilityId} required>
          <select {...fieldAria("facilityId", fe.facilityId)} defaultValue={initial?.facilityId ?? defaultFacilityId ?? facilities[0]?.id} className="input">
            {facilities.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Date and time" name="occurredAt" error={fe.occurredAt} required>
          <input
            id="occurredAt"
            type="datetime-local"
            value={occurredAt}
            max={maxDate}
            onChange={(e) => setOccurredAt(e.target.value)}
            aria-invalid={fe.occurredAt ? true : undefined}
            className="input"
            required
          />
        </Field>
        <Field label="Supplier" name="supplierName" error={fe.supplierName} hint="Pick an existing supplier or type a new name.">
          <input {...fieldAria("supplierName", fe.supplierName)} defaultValue={initial?.supplierName ?? ""} list="supplier-options" autoComplete="off" maxLength={160} className="input" />
          <datalist id="supplier-options">
            {suppliers.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </Field>
        <Field label="Purchase order (PO) number" name="poNumber" error={fe.poNumber}>
          <input {...fieldAria("poNumber", fe.poNumber)} defaultValue={initial?.poNumber ?? ""} maxLength={64} autoComplete="off" className="input" />
        </Field>
        <Field label="Shipment / BOL / ASN reference" name="shipmentRef" error={fe.shipmentRef}>
          <input {...fieldAria("shipmentRef", fe.shipmentRef)} defaultValue={initial?.shipmentRef ?? ""} maxLength={64} autoComplete="off" className="input" />
        </Field>
        <Field label="SKU / item number" name="sku" error={fe.sku}>
          <input {...fieldAria("sku", fe.sku)} defaultValue={initial?.sku ?? ""} maxLength={64} autoComplete="off" className="input" />
        </Field>
        <Field label="Item description" name="itemDescription" error={fe.itemDescription} className="sm:col-span-2">
          <input {...fieldAria("itemDescription", fe.itemDescription)} defaultValue={initial?.itemDescription ?? ""} maxLength={300} className="input" />
        </Field>
        <div className="grid grid-cols-2 gap-4 sm:col-span-2 sm:grid-cols-3">
          <Field label="Expected qty" name="expectedQty" error={fe.expectedQty} required={type === "shortage" || type === "overage"}>
            <input
              {...fieldAria("expectedQty", fe.expectedQty)}
              inputMode="decimal"
              value={expected}
              onChange={(e) => setExpected(e.target.value)}
              className="input tabular-nums"
            />
          </Field>
          <Field label="Received qty" name="receivedQty" error={fe.receivedQty} required={type === "shortage" || type === "overage"}>
            <input
              {...fieldAria("receivedQty", fe.receivedQty)}
              inputMode="decimal"
              value={received}
              onChange={(e) => setReceived(e.target.value)}
              className="input tabular-nums"
            />
          </Field>
          <div className="col-span-2 sm:col-span-1">
            <p className="label">Variance</p>
            <p
              className={cx(
                "rounded-md border border-dashed border-slate-300 px-3 py-2 text-[15px] tabular-nums",
                diff === null ? "text-slate-400" : diff < 0 ? "text-red-700" : diff > 0 ? "text-amber-800" : "text-slate-700",
              )}
              aria-live="polite"
            >
              {diff === null ? "—" : `${diff > 0 ? "+" : ""}${formatQty(diff)}`}
            </p>
          </div>
        </div>
        <Field label="Description" name="description" error={fe.description} required className="sm:col-span-2" hint="What did you find? Include carton counts, damage details, labels.">
          <textarea {...fieldAria("description", fe.description)} defaultValue={initial?.description ?? ""} rows={4} maxLength={5000} className="input" required />
        </Field>
      </div>

      {!initial && (
      <div className="card p-4 sm:p-5">
        <p className="label">Photos and documents</p>
        <p className="mb-3 text-xs text-slate-500">JPEG, PNG, WebP, HEIC or PDF · up to 10 MB each · stored privately.</p>
        <label className={buttonClass("secondary", "md", "cursor-pointer")}>
          <Camera className="h-4 w-4" aria-hidden /> Add photos or files
          <input type="file" multiple accept={EVIDENCE_ACCEPT} className="sr-only" onChange={(e) => (addFiles(e.target.files), (e.target.value = ""))} />
        </label>
        {files.length > 0 && (
          <ul className="mt-3 divide-y divide-slate-100 rounded-md border border-slate-200">
            {files.map((f, i) => (
              <li key={`${f.name}-${i}`} className="flex items-center gap-2 px-3 py-2 text-sm">
                <FileText className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                <span className="min-w-0 flex-1 truncate">{f.name}</span>
                <span className="text-xs text-slate-500">{formatBytes(f.size)}</span>
                <button
                  type="button"
                  onClick={() => {
                    const next = files.filter((_, j) => j !== i);
                    setFiles(next);
                    setFileErrors(precheckFiles(next));
                  }}
                  className="rounded p-1 text-slate-500 hover:bg-slate-100"
                  aria-label={`Remove ${f.name}`}
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
        {fileErrors.length > 0 && (
          <div className="mt-3">
            <Alert>
              <ul className="list-disc pl-4">
                {fileErrors.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </Alert>
          </div>
        )}
      </div>

      )}

      <div className="sticky bottom-0 -mx-4 flex gap-2 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:flex-row sm:justify-end sm:border-0 sm:bg-transparent sm:p-0">
        <button type="button" onClick={() => router.back()} className={buttonClass("secondary", "md", "shrink-0")} disabled={Boolean(busy)}>
          Cancel
        </button>
        <button type="submit" className={buttonClass("primary", "lg", "flex-1 sm:flex-none")} disabled={Boolean(busy)} aria-busy={Boolean(busy)}>
          {busy ?? (initial ? "Save changes" : "Submit exception")}
        </button>
      </div>
    </form>
  );
}
