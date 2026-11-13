import { ArrowRight, Clock, MapPin, Truck, UserPlus } from "lucide-react";
import type { Technician } from "@/lib/mock-fleet-data";
import { EquipmentPill, ExperienceBadge, ReadingChip, STATUS_META, StatusBadge, formatElapsed } from "./fleet-ui";

export function TechCard({ tech, onInspect }: { tech: Technician; onInspect: (id: string) => void }) {
  const meta = STATUS_META[tech.status];
  const done = tech.status === "completed";
  const passed = tech.steps.filter((s) => s.status === "passed" || s.status === "failed").length;
  const pct = done ? 100 : Math.round((passed / 5) * 100);
  const bar =
    tech.status === "escalated" ? "bg-danger" : tech.status === "safety_hold" ? "bg-amber" : done ? "bg-sky-400" : "bg-emerald";
  const latest = tech.readings.slice(-3);

  return (
    <article
      aria-label={`${tech.name}, ${meta.label.toLowerCase()}`}
      className={`flex flex-col rounded-2xl border bg-steel p-4 transition-colors ${meta.border}`}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-bold text-ink">{tech.name}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <ExperienceBadge tech={tech} />
            <span className="inline-flex items-center gap-1 font-mono text-[11px] text-amber">
              <Truck className="h-3 w-3" aria-hidden="true" />
              {tech.truck}
            </span>
          </div>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 font-mono text-[11px] text-muted" title="Time on site">
          <Clock className="h-3 w-3" aria-hidden="true" />
          {formatElapsed(tech.elapsedSec)}
        </span>
      </header>

      <p className="mt-2 flex items-center gap-1.5 truncate text-xs text-slate-400">
        <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
        <span className="truncate">
          {tech.customer} · {tech.city}
        </span>
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <StatusBadge status={tech.status} />
        {tech.backupDispatched && (
          <span className="inline-flex items-center gap-1 rounded-md bg-amber/10 px-1.5 py-1 font-mono text-[10px] font-bold text-amber ring-1 ring-amber/40">
            <UserPlus className="h-3 w-3" aria-hidden="true" /> BACKUP EN ROUTE
          </span>
        )}
      </div>
      {tech.statusReason && tech.status !== "coaching" && (
        <p className={`mt-2 line-clamp-2 text-xs ${tech.status === "escalated" ? "text-red-200" : tech.status === "safety_hold" ? "text-amber-hi" : "text-slate-400"}`}>
          {tech.statusReason}
        </p>
      )}

      <div className="mt-3">
        <EquipmentPill equipment={tech.equipment} />
      </div>

      <div className="mt-3">
        <div className="flex items-center justify-between font-mono text-[11px] text-muted">
          <span>{done ? "ALL 5 STEPS COMPLETE" : `STEP ${tech.currentStep} OF 5`}</span>
          <span>{pct}%</span>
        </div>
        <div
          className="mt-1 h-1.5 overflow-hidden rounded-full bg-line"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={5}
          aria-valuenow={done ? 5 : passed}
          aria-label="Diagnostic progress"
        >
          <div className={`h-full rounded-full transition-[width] duration-700 ${bar}`} style={{ width: `${Math.max(pct, 4)}%` }} />
        </div>
        <p className="mt-2 line-clamp-2 min-h-10 text-sm text-slate-200">{tech.stepSummary}</p>
      </div>

      <div className="mt-2 flex min-h-6 flex-wrap gap-1.5">
        {latest.length ? latest.map((r) => <ReadingChip key={r.id} reading={r} />) : <span className="font-mono text-[11px] text-muted">No readings yet</span>}
      </div>

      <button
        type="button"
        onClick={() => onInspect(tech.id)}
        className={`mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-semibold transition-colors ${
          tech.status === "escalated"
            ? "border-danger bg-danger text-white hover:bg-red-500"
            : tech.status === "safety_hold"
              ? "border-amber bg-amber text-slate-deep hover:bg-amber-hi"
              : "border-line-strong text-ink hover:border-amber hover:text-amber"
        }`}
      >
        Inspect Live Session <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </button>
    </article>
  );
}
