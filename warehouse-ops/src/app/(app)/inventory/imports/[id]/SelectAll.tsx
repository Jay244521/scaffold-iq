"use client";

/** Checkbox that selects/deselects every line checkbox in the same form. */
export function SelectAll({ label = "Select all on this page" }: { label?: string }) {
  return (
    <label className="inline-flex items-center gap-2 text-sm text-slate-700">
      <input
        type="checkbox"
        onChange={(e) => {
          e.currentTarget.form?.querySelectorAll<HTMLInputElement>('input[name="lineId"]').forEach((c) => (c.checked = e.currentTarget.checked));
        }}
      />
      {label}
    </label>
  );
}
