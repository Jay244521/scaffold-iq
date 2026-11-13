"use client";

import { Search, X } from "lucide-react";
import type { FleetFilter } from "@/lib/fleet-sim";

const PILLS: { id: FleetFilter; label: string }[] = [
  { id: "all", label: "All Techs" },
  { id: "attention", label: "Needs Attention / Escalated" },
  { id: "apprentices", label: "Apprentices (Year 1)" },
  { id: "in_progress", label: "In Progress" },
  { id: "completed", label: "Completed Today" },
];

export function FleetControls({
  filter,
  onFilter,
  counts,
  query,
  onQuery,
  autoTick,
  onAutoTick,
}: {
  filter: FleetFilter;
  onFilter: (f: FleetFilter) => void;
  counts: Record<FleetFilter, number>;
  query: string;
  onQuery: (q: string) => void;
  autoTick: boolean;
  onAutoTick: (on: boolean) => void;
}) {
  return (
    <section aria-label="Filter technicians" className="flex flex-col gap-3 rounded-2xl border border-line bg-steel p-3 sm:p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <label className="relative flex-1">
          <span className="sr-only">Search technicians</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Search tech, truck #, customer or brand (Carrier, Trane, Lennox…)"
            className="h-11 w-full rounded-xl border border-line-strong bg-slate-deep pl-9 pr-9 text-sm text-ink placeholder:text-muted focus:border-amber focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => onQuery("")}
              aria-label="Clear search"
              className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-muted hover:text-ink"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </label>

        <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-xl border border-line-strong bg-slate-deep px-3 lg:justify-start">
          <span className="text-sm font-medium text-slate-200">Simulate Live Updates (Auto-Tick)</span>
          <input type="checkbox" role="switch" checked={autoTick} onChange={(e) => onAutoTick(e.target.checked)} className="peer sr-only" />
          <span
            aria-hidden="true"
            className="relative h-6 w-11 shrink-0 rounded-full bg-line-strong transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-ink after:transition-transform peer-checked:bg-emerald peer-checked:after:translate-x-5 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-amber"
          />
        </label>
      </div>

      <div role="radiogroup" aria-label="Status filter" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {PILLS.map((p) => {
          const on = filter === p.id;
          const alert = p.id === "attention" && counts.attention > 0;
          return (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onFilter(p.id)}
              className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full border px-3.5 text-sm font-semibold transition-colors ${
                on
                  ? "border-amber bg-amber text-slate-deep"
                  : alert
                    ? "border-danger/50 bg-danger/10 text-red-200 hover:border-danger"
                    : "border-line-strong text-slate-300 hover:border-amber hover:text-amber"
              }`}
            >
              {p.label}
              <span
                className={`rounded-full px-1.5 font-mono text-[11px] ${on ? "bg-slate-deep/15" : alert ? "bg-danger text-white" : "bg-line"}`}
              >
                {counts[p.id]}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
