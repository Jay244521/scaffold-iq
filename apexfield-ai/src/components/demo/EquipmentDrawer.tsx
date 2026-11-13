"use client";

import { useState } from "react";
import { ChevronDown, CircleCheck, Cpu } from "lucide-react";
import type { Scenario } from "@/lib/demo-scenarios";

export function EquipmentDrawer({ scenario }: { scenario: Scenario }) {
  const [open, setOpen] = useState(true);
  const e = scenario.equipment;
  const fields: [string, string][] = [
    ["MANUFACTURER", e.manufacturer],
    ["MODEL", e.model],
    ["SERIAL", e.serial],
    ["REFRIGERANT", e.refrigerant],
    ["TONNAGE", e.tonnage],
    ["ELECTRICAL", e.electrical],
    [e.keySpec.label.toUpperCase(), e.keySpec.value],
  ];

  return (
    <section aria-label="Active equipment context" className="rounded-2xl border border-line bg-steel">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="equipment-drawer"
        className="flex min-h-14 w-full items-center justify-between gap-3 px-4 py-3 text-left sm:px-5"
      >
        <span className="flex min-w-0 items-center gap-3">
          <Cpu className="h-5 w-5 shrink-0 text-amber" aria-hidden="true" />
          <span className="min-w-0">
            <span className="block font-mono text-[11px] tracking-[0.1em] text-muted">ACTIVE EQUIPMENT CONTEXT</span>
            <span className="block truncate font-mono text-sm text-ink">
              {e.manufacturer.toUpperCase()} {e.model} · {e.tonnage} · {e.refrigerant}
            </span>
          </span>
        </span>
        <ChevronDown className={`h-5 w-5 shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>
      <div
        id="equipment-drawer"
        className={`grid transition-[grid-template-rows] duration-300 ease-out ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
      >
        <div className="overflow-hidden">
          <div className="border-t border-line px-4 pb-4 pt-4 sm:px-5">
            <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
              {fields.map(([k, v]) => (
                <div key={k} className="rounded-lg border border-line bg-slate-deep px-3 py-2">
                  <dt className="font-mono text-[10px] tracking-[0.08em] text-muted">{k}</dt>
                  <dd className="mt-0.5 break-words font-mono text-[13px] text-ink">{v}</dd>
                </div>
              ))}
            </dl>
            <ul className="mt-3 flex flex-wrap gap-2">
              {e.docs.map((d) => (
                <li
                  key={d}
                  className="flex items-center gap-1.5 rounded-md bg-emerald/10 px-2.5 py-1 font-mono text-[11px] text-emerald"
                >
                  <CircleCheck className="h-3.5 w-3.5" aria-hidden="true" /> {d} loaded
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
