import { DollarSign, ShieldAlert, Target, Truck } from "lucide-react";
import { FLEET_TOTAL_TRUCKS, type Technician } from "@/lib/mock-fleet-data";

/** Executive KPIs. 30-day / MTD figures are seeded business metrics; escalations are live. */
const FIRST_TIME_FIX = { rate: "94.2%", delta: "+18.4% vs. pre-ApexField baseline" };
const PREVENTED_ROLLS_MTD = 27;
const AVG_TRUCK_ROLL_COST = 325;

export function FleetKpiHeader({ techs }: { techs: Technician[] }) {
  const escalated = techs.filter((t) => t.status === "escalated").length;
  const holds = techs.filter((t) => t.status === "safety_hold").length;
  const attention = escalated + holds;
  const coaching = techs.filter((t) => t.status === "coaching").length;
  const completed = techs.filter((t) => t.status === "completed").length;
  const alertTone = escalated > 0 ? "danger" : holds > 0 ? "amber" : "calm";

  return (
    <section aria-label="Fleet metrics" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <Kpi
        icon={<Truck className="h-4 w-4" />}
        label="Active Field Sessions"
        value={
          <>
            {techs.length} <span className="text-muted">/ {FLEET_TOTAL_TRUCKS}</span>
          </>
        }
        unit="Trucks Active"
        sub={`${coaching} coaching now · ${completed} completed today`}
        live
      />
      <Kpi icon={<Target className="h-4 w-4" />} label="First-Time Fix Rate (30-Day)" value={FIRST_TIME_FIX.rate} sub={FIRST_TIME_FIX.delta} subTone="emerald" />
      <Kpi
        icon={<DollarSign className="h-4 w-4" />}
        label="Second-Truck Dispatches Prevented (MTD)"
        value={PREVENTED_ROLLS_MTD}
        unit="Truck Rolls"
        sub={`~$${(PREVENTED_ROLLS_MTD * AVG_TRUCK_ROLL_COST).toLocaleString("en-US")} saved`}
        subTone="emerald"
      />
      <Kpi
        icon={<ShieldAlert className="h-4 w-4" />}
        label="Active Escalations / Safety Holds"
        value={attention}
        unit={attention === 1 ? "Needs Attention" : "Need Attention"}
        sub={attention ? `${escalated} escalated · ${holds} safety ${holds === 1 ? "hold" : "holds"}` : "All sessions clear"}
        tone={alertTone}
      />
    </section>
  );
}

function Kpi({
  icon,
  label,
  value,
  unit,
  sub,
  subTone,
  live,
  tone = "calm",
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  unit?: string;
  sub: string;
  subTone?: "emerald";
  live?: boolean;
  tone?: "calm" | "amber" | "danger";
}) {
  const shell =
    tone === "danger"
      ? "border-danger/70 bg-gradient-to-br from-danger/15 to-steel"
      : tone === "amber"
        ? "border-amber/60 bg-gradient-to-br from-amber/12 to-steel"
        : "border-line bg-steel";
  const valueTone = tone === "danger" ? "text-danger" : tone === "amber" ? "text-amber" : "text-ink";
  return (
    <div className={`min-w-0 rounded-2xl border p-3 transition-colors sm:p-4 ${shell}`}>
      <p className="flex items-start gap-2 text-[11px] font-medium leading-tight text-muted sm:items-center sm:text-xs">
        <span className={`shrink-0 ${tone === "calm" ? "text-amber" : valueTone}`} aria-hidden="true">
          {icon}
        </span>
        {label}
        {live && (
          <span className="relative ml-auto flex h-2.5 w-2.5 shrink-0" aria-label="Live">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald opacity-60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald" />
          </span>
        )}
      </p>
      <p className={`mt-2 flex flex-wrap items-baseline gap-x-2 font-mono text-2xl font-bold tracking-tight sm:text-3xl ${valueTone}`}>
        {value}
        {unit && <span className="font-sans text-xs font-semibold text-slate-300 sm:text-sm">{unit}</span>}
      </p>
      <p className={`mt-1 text-[11px] leading-snug sm:text-xs ${subTone === "emerald" ? "text-emerald" : tone === "calm" ? "text-muted" : "text-slate-300"}`}>{sub}</p>
    </div>
  );
}
