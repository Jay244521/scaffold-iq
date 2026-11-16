"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { FileSpreadsheet } from "lucide-react";
import { Alert, Card, buttonClass, cx } from "@/components/ui";
import { LINE_STATUS_LABELS } from "@/lib/inventory";
import { formatQty } from "@/lib/labels";
import { previewInventoryFile, saveInventoryImport, type PreviewResult } from "../actions";

const statusStyle: Record<string, string> = {
  invalid: "bg-red-50 text-red-800 ring-red-200",
  discrepancy: "bg-amber-50 text-amber-900 ring-amber-200",
  new_item: "bg-sky-50 text-sky-900 ring-sky-200",
  match: "bg-slate-100 text-slate-700 ring-slate-200",
};

export function ImportWizard({ facilities, defaultFacilityId }: { facilities: { id: string; name: string }[]; defaultFacilityId: string | null }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function check(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPreview(null);
    setBusy("Checking file…");
    try {
      const res = await previewInventoryFile(new FormData(e.currentTarget));
      if (res.error) setError(res.error);
      else setPreview(res);
    } catch {
      setError("Connection problem. Please try again.");
    }
    setBusy(null);
  }

  async function save() {
    if (!formRef.current) return;
    setBusy("Saving for review…");
    setError(null);
    try {
      const res = await saveInventoryImport(new FormData(formRef.current));
      if (res.importId) return router.push(`/inventory/imports/${res.importId}?notice=created`);
      setError(res.error ?? "Could not save the import.");
    } catch {
      setError("Connection problem. Please try again.");
    }
    setBusy(null);
  }

  const c = preview?.counts;
  return (
    <div className="space-y-6">
      <form ref={formRef} onSubmit={check} className="card grid gap-4 p-4 sm:grid-cols-2 sm:p-5" onChange={() => setPreview(null)}>
        <div>
          <label htmlFor="facilityId" className="label">Facility</label>
          <select id="facilityId" name="facilityId" defaultValue={defaultFacilityId ?? facilities[0]?.id} className="input">
            {facilities.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
        </div>
        <fieldset>
          <legend className="label">What is this file?</legend>
          <div className="flex flex-col gap-2 text-sm sm:flex-row sm:gap-4">
            <label className="flex items-center gap-2"><input type="radio" name="source" value="count" defaultChecked /> Physical count</label>
            <label className="flex items-center gap-2"><input type="radio" name="source" value="system" /> Export from WMS / ERP</label>
          </div>
        </fieldset>
        <div className="sm:col-span-2">
          <label htmlFor="file" className="label">CSV file</label>
          <input id="file" name="file" type="file" accept=".csv,text/csv,.txt" required className="input file:mr-3 file:rounded file:border-0 file:bg-slate-100 file:px-3 file:py-1 file:text-sm" />
          <p className="mt-1 text-xs text-slate-500">
            Needs columns for <strong>SKU</strong> and <strong>quantity</strong>; location, description and unit cost are optional. Up to 5,000 rows, 2 MB.{" "}
            <a href="/inventory/template" className="font-medium text-brand-600 hover:underline">Download a template</a>.
          </p>
        </div>
        <div className="sm:col-span-2">
          <button className={buttonClass("primary")} disabled={Boolean(busy)}>
            <FileSpreadsheet className="h-4 w-4" aria-hidden /> {busy === "Checking file…" ? busy : "Check file"}
          </button>
        </div>
      </form>

      {error && <Alert>{error}</Alert>}

      {preview && c && (
        <>
          <Card title={`Preview: ${preview.fileName}`}>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {[
                ["Rows", c.total, ""],
                ["Discrepancies", c.discrepancy, "text-amber-800"],
                ["Not in records", c.new_item, "text-sky-800"],
                ["Match records", c.match, "text-slate-700"],
                ["Invalid", c.invalid, "text-red-700"],
              ].map(([label, v, cls]) => (
                <div key={label as string} className="rounded-md border border-slate-200 px-3 py-2">
                  <p className="text-xs text-slate-500">{label}</p>
                  <p className={cx("text-xl font-semibold tabular-nums", cls as string)}>{(v as number).toLocaleString()}</p>
                </div>
              ))}
            </div>
            <p className="mt-4 text-sm text-slate-600">
              Columns used:{" "}
              {preview.columns!.filter((col) => col.header).map((col) => `${col.label} ← "${col.header}"`).join(" · ")}
            </p>
            {c.invalid > 0 && (
              <div className="mt-3"><Alert tone="warning">{c.invalid} invalid row{c.invalid === 1 ? "" : "s"} will be kept for reference but can&apos;t be applied. Fix them in your file and upload again if needed.</Alert></div>
            )}
            <div className="-mx-4 mt-4 overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 pb-2 font-medium">Row</th>
                    <th className="px-2 pb-2 font-medium">SKU</th>
                    <th className="px-2 pb-2 font-medium">Location</th>
                    <th className="px-2 pb-2 text-right font-medium">Record</th>
                    <th className="px-2 pb-2 text-right font-medium">File</th>
                    <th className="px-2 pb-2 text-right font-medium">Difference</th>
                    <th className="px-4 pb-2 font-medium">Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 tabular-nums">
                  {preview.lines!.map((l) => (
                    <tr key={l.line_no}>
                      <td className="px-4 py-1.5 text-slate-500">{l.line_no}</td>
                      <td className="px-2 py-1.5 font-mono text-xs">{l.sku || "—"}</td>
                      <td className="px-2 py-1.5">{l.location || "—"}</td>
                      <td className="px-2 py-1.5 text-right">{formatQty(l.recorded)}</td>
                      <td className="px-2 py-1.5 text-right">{formatQty(l.qty)}</td>
                      <td className={cx("px-2 py-1.5 text-right", (l.variance ?? 0) < 0 ? "text-red-700" : (l.variance ?? 0) > 0 ? "text-amber-800" : "")}>
                        {l.variance === null ? "—" : `${l.variance > 0 ? "+" : ""}${formatQty(l.variance)}`}
                      </td>
                      <td className="px-4 py-1.5">
                        <span className={cx("inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset", statusStyle[l.status])}>{LINE_STATUS_LABELS[l.status]}</span>
                        {l.error && <span className="ml-2 text-xs text-red-700">{l.error}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {preview.truncated && <p className="mt-2 text-xs text-slate-500">Showing the first 300 rows (problems and differences first). All rows are saved.</p>}
          </Card>

          <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-700">
              Saving creates a review list. <strong>No inventory quantities change</strong> until a manager approves each correction and applies them.
            </p>
            <button type="button" onClick={save} className={buttonClass("primary", "md", "shrink-0")} disabled={Boolean(busy) || c.total === c.invalid}>
              {busy === "Saving for review…" ? busy : "Save for review"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
