"use client";

import { useState } from "react";
import { SubmitButton, useFormAction } from "@/components/client";
import { buttonClass } from "@/components/ui";
import type { ActionState } from "@/lib/validation";
import { mergeSupplier, renameSupplier } from "./actions";

export function SupplierControls({ id, name, others }: { id: string; name: string; others: { id: string; name: string }[] }) {
  const [mode, setMode] = useState<"none" | "rename" | "merge">("none");
  const [renameState, renameAction, renaming] = useFormAction(renameSupplier, {} as ActionState);
  const [mergeState, mergeAction, merging] = useFormAction(mergeSupplier, {} as ActionState);
  const msg = renameState.error ?? mergeState.error;
  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      {mode === "none" && (
        <div className="flex gap-1">
          <button type="button" onClick={() => setMode("rename")} className={buttonClass("ghost", "sm")}>Rename</button>
          {others.length > 0 && <button type="button" onClick={() => setMode("merge")} className={buttonClass("ghost", "sm")}>Merge…</button>}
        </div>
      )}
      {mode === "rename" && (
        <form onSubmit={renameAction} className="flex flex-wrap gap-2">
          <input type="hidden" name="supplierId" value={id} />
          <label className="sr-only" htmlFor={`rename-${id}`}>New name</label>
          <input id={`rename-${id}`} name="name" defaultValue={name} maxLength={160} className="input !w-56 !py-1 !text-sm" required />
          <SubmitButton size="sm" pending={renaming}>Save</SubmitButton>
          <button type="button" onClick={() => setMode("none")} className={buttonClass("ghost", "sm")}>Cancel</button>
        </form>
      )}
      {mode === "merge" && (
        <form
          onSubmit={(e) => {
            const target = (e.currentTarget.elements.namedItem("intoId") as HTMLSelectElement).selectedOptions[0]?.text;
            if (!confirm(`Move all of "${name}"'s incidents to "${target}" and remove "${name}"? This can't be undone.`)) return e.preventDefault();
            mergeAction(e);
          }}
          className="flex flex-wrap gap-2"
        >
          <input type="hidden" name="supplierId" value={id} />
          <label className="sr-only" htmlFor={`merge-${id}`}>Merge into</label>
          <select id={`merge-${id}`} name="intoId" className="input !w-56 !py-1 !text-sm" required defaultValue="">
            <option value="" disabled>Merge into…</option>
            {others.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
          <SubmitButton size="sm" variant="danger" pending={merging}>Merge</SubmitButton>
          <button type="button" onClick={() => setMode("none")} className={buttonClass("ghost", "sm")}>Cancel</button>
        </form>
      )}
      {msg && <p className="text-xs text-red-700">{msg}</p>}
      {(renameState.success || mergeState.success) && !msg && <p className="text-xs text-emerald-700">{renameState.success ?? mergeState.success}</p>}
    </div>
  );
}
