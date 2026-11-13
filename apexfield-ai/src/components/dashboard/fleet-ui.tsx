import type { Equipment, Reading, TechStatus, Technician } from "@/lib/mock-fleet-data";

export function formatElapsed(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function experienceLabel(t: Pick<Technician, "role" | "experienceMonths">): string {
  if (t.experienceMonths <= 0) return `${t.role} • new`;
  return t.experienceMonths < 12
    ? `${t.role} • ${t.experienceMonths} mos`
    : `${t.role} • ${Math.floor(t.experienceMonths / 12)} yr${t.experienceMonths >= 24 ? "s" : ""}`;
}

export function ExperienceBadge({ tech }: { tech: Technician }) {
  const junior = tech.experienceMonths < 12;
  return (
    <span
      className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${
        junior ? "bg-amber/12 text-amber-hi ring-1 ring-amber/30" : "bg-steel-2 text-slate-300 ring-1 ring-line-strong"
      }`}
    >
      {experienceLabel(tech)}
    </span>
  );
}

export const STATUS_META: Record<TechStatus, { label: string; badge: string; border: string; dot: string }> = {
  coaching: {
    label: "COACHING ACTIVE",
    badge: "bg-emerald/12 text-emerald ring-emerald/40",
    border: "border-line hover:border-emerald/50",
    dot: "bg-emerald",
  },
  safety_hold: {
    label: "SAFETY GATE HOLD",
    badge: "bg-amber/15 text-amber ring-amber/50",
    border: "border-amber/60",
    dot: "bg-amber",
  },
  escalated: {
    label: "ESCALATED — NEEDS REVIEW",
    badge: "bg-danger/15 text-danger ring-danger/50",
    border: "border-danger/70 animate-escalate",
    dot: "bg-danger",
  },
  ended: {
    label: "SESSION ENDED",
    badge: "bg-line text-muted ring-line-strong",
    border: "border-line opacity-75",
    dot: "bg-muted",
  },
  completed: {
    label: "JOB COMPLETED",
    badge: "bg-sky-400/10 text-sky-300 ring-sky-400/30",
    border: "border-line opacity-90",
    dot: "bg-sky-400",
  },
};

export function StatusBadge({ status }: { status: TechStatus }) {
  const m = STATUS_META[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 font-mono text-[10px] font-bold tracking-wider ring-1 ${m.badge}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${m.dot} ${status === "coaching" || status === "escalated" ? "animate-pulse" : ""}`} />
      {m.label}
    </span>
  );
}

export function equipmentLabel(e: Equipment): string {
  return `${e.brand.toUpperCase()} ${e.model} • ${e.refrigerant} • ${e.size}`;
}

export function EquipmentPill({ equipment }: { equipment: Equipment }) {
  const label = equipmentLabel(equipment);
  return (
    <span title={label} className="block truncate rounded-md border border-line bg-slate-deep px-2 py-1 font-mono text-[11px] text-slate-300">
      {label}
    </span>
  );
}

export const READING_TONE: Record<Reading["status"], string> = {
  ok: "border-line-strong text-slate-200",
  low: "border-amber/60 text-amber-hi bg-amber/10",
  high: "border-danger/60 text-red-300 bg-danger/10",
  out: "border-gauge/60 text-amber-hi bg-gauge/10",
};

export function ReadingChip({ reading }: { reading: Reading }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono text-[11px] ${READING_TONE[reading.status]}`}>
      <span className="text-muted">{reading.short}:</span>
      <b className="font-semibold">
        {reading.value}
        {reading.unit.startsWith("°") ? "" : " "}
        {reading.unit}
      </b>
      {reading.status !== "ok" && <span className="font-bold">[{reading.status.toUpperCase()}]</span>}
    </span>
  );
}
