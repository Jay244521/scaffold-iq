import { ShieldAlert, ShieldCheck } from "lucide-react";
import type { EquipmentKind, Technician } from "@/lib/mock-fleet-data";
import { formatElapsed } from "./fleet-ui";

/** Detection boxes drawn over the frame, by the step the AI is on. Coordinates in a 640×360 viewBox. */
const TARGETS: Record<EquipmentKind, Record<number, { x: number; y: number; w: number; h: number; label: string }>> = {
  split_ac: {
    1: { x: 360, y: 214, w: 92, h: 52, label: "DATA PLATE" },
    2: { x: 196, y: 70, w: 70, h: 60, label: "CONTACTOR COIL" },
    3: { x: 486, y: 64, w: 82, h: 96, label: "SERVICE DISCONNECT" },
    4: { x: 196, y: 70, w: 70, h: 60, label: "CAPACITOR / CONTACTOR" },
    5: { x: 400, y: 268, w: 150, h: 70, label: "MANIFOLD GAUGES" },
  },
  heat_pump: {
    1: { x: 360, y: 214, w: 92, h: 52, label: "DATA PLATE" },
    2: { x: 196, y: 70, w: 70, h: 60, label: "CONTACTOR COIL" },
    3: { x: 486, y: 64, w: 82, h: 96, label: "SERVICE DISCONNECT" },
    4: { x: 196, y: 70, w: 70, h: 60, label: "DUAL RUN CAPACITOR" },
    5: { x: 400, y: 268, w: 150, h: 70, label: "MANIFOLD GAUGES" },
  },
  rtu: {
    1: { x: 92, y: 226, w: 96, h: 46, label: "DATA PLATE" },
    2: { x: 214, y: 196, w: 110, h: 80, label: "CONTROL BOARD" },
    3: { x: 500, y: 150, w: 72, h: 92, label: "UNIT DISCONNECT" },
    4: { x: 214, y: 196, w: 110, h: 80, label: "COMPRESSOR CONTACTOR" },
    5: { x: 350, y: 196, w: 120, h: 80, label: "STATIC / SUCTION PORT" },
  },
  furnace: {
    1: { x: 266, y: 84, w: 108, h: 48, label: "DATA PLATE" },
    2: { x: 266, y: 150, w: 108, h: 60, label: "CONTROL BOARD" },
    3: { x: 420, y: 96, w: 64, h: 64, label: "SERVICE SWITCH" },
    4: { x: 270, y: 226, w: 100, h: 52, label: "IGNITER / INDUCER" },
    5: { x: 230, y: 30, w: 180, h: 40, label: "SUPPLY PLENUM PROBE" },
  },
};

function Condenser({ heatPump }: { heatPump: boolean }) {
  return (
    <g stroke="#475569" strokeWidth="2" fill="none">
      <rect x="160" y="40" width="300" height="290" rx="10" fill="#111827" />
      {Array.from({ length: 22 }, (_, i) => (
        <line key={i} x1={172 + i * 13} y1="52" x2={172 + i * 13} y2="318" stroke="#1f2937" />
      ))}
      <circle cx="310" cy="175" r="100" fill="#0b0f19" />
      {[80, 60, 40].map((r) => (
        <circle key={r} cx="310" cy="175" r={r} stroke="#334155" />
      ))}
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i * Math.PI) / 4;
        return <line key={i} x1="310" y1="175" x2={310 + Math.cos(a) * 100} y2={175 + Math.sin(a) * 100} stroke="#334155" />;
      })}
      <circle cx="310" cy="175" r="14" fill="#1e293b" />
      {/* control box */}
      <rect x="200" y="76" width="62" height="48" rx="4" fill="#0f172a" stroke="#64748b" />
      <rect x="210" y="86" width="18" height="28" rx="3" fill="#1e3a8a" stroke="#60a5fa" />
      <rect x="236" y="88" width="18" height="24" rx="2" fill="#1f2937" stroke="#94a3b8" />
      {/* data plate */}
      <rect x="366" y="220" width="80" height="40" rx="2" fill="#cbd5e1" stroke="#94a3b8" />
      {[230, 238, 246, 254].map((y) => (
        <line key={y} x1="372" y1={y} x2={y === 230 ? 420 : 436} y2={y} stroke="#475569" strokeWidth="1.5" />
      ))}
      {heatPump && <text x="310" y="318" fill="#64748b" fontSize="11" textAnchor="middle" fontFamily="monospace" stroke="none">REVERSING VALVE ▸</text>}
      {/* disconnect + whip */}
      <rect x="492" y="70" width="70" height="84" rx="4" fill="#1f2937" stroke="#64748b" />
      <rect x="512" y="92" width="30" height="40" rx="3" fill="#0b0f19" stroke="#94a3b8" />
      <path d="M527 154 C527 200, 470 210, 460 250" stroke="#64748b" strokeWidth="5" />
      {/* lines to gauges */}
      <path d="M460 300 C480 300, 470 330, 420 320" stroke="#3b82f6" strokeWidth="3" />
      <path d="M460 312 C500 312, 520 330, 520 318" stroke="#ef4444" strokeWidth="3" />
      <circle cx="440" cy="304" r="24" fill="#0f172a" stroke="#3b82f6" strokeWidth="3" />
      <circle cx="512" cy="304" r="24" fill="#0f172a" stroke="#ef4444" strokeWidth="3" />
      <line x1="440" y1="304" x2="452" y2="290" stroke="#e2e8f0" />
      <line x1="512" y1="304" x2="526" y2="296" stroke="#e2e8f0" />
    </g>
  );
}

function RooftopUnit() {
  return (
    <g stroke="#475569" strokeWidth="2" fill="none">
      <rect x="60" y="120" width="460" height="200" rx="8" fill="#111827" />
      <rect x="60" y="96" width="460" height="28" rx="4" fill="#0f172a" />
      {[160, 300, 440].map((cx) => (
        <ellipse key={cx} cx={cx} cy="110" rx="52" ry="10" stroke="#334155" />
      ))}
      {Array.from({ length: 16 }, (_, i) => (
        <line key={i} x1="360" y1={136 + i * 11} x2="500" y2={136 + i * 11} stroke="#1f2937" />
      ))}
      <rect x="220" y="200" width="98" height="70" rx="3" fill="#0f172a" stroke="#64748b" />
      <rect x="232" y="212" width="40" height="28" fill="#064e3b" stroke="#10b981" />
      <rect x="280" y="212" width="28" height="46" fill="#1f2937" stroke="#94a3b8" />
      <rect x="98" y="232" width="84" height="34" rx="2" fill="#cbd5e1" stroke="#94a3b8" />
      {[242, 250, 258].map((y) => (
        <line key={y} x1="104" y1={y} x2="170" y2={y} stroke="#475569" strokeWidth="1.5" />
      ))}
      <rect x="506" y="156" width="60" height="80" rx="4" fill="#1f2937" stroke="#64748b" />
      <rect x="522" y="176" width="28" height="38" rx="3" fill="#0b0f19" stroke="#94a3b8" />
      <circle cx="410" cy="236" r="10" fill="#0b0f19" stroke="#f59e0b" />
      <path d="M410 246 C410 290, 470 300, 590 310" stroke="#64748b" strokeWidth="3" />
      <line x1="20" y1="330" x2="620" y2="330" stroke="#1f2937" strokeWidth="4" />
    </g>
  );
}

function Furnace() {
  return (
    <g stroke="#475569" strokeWidth="2" fill="none">
      <rect x="220" y="20" width="200" height="56" fill="#0f172a" />
      <rect x="240" y="76" width="160" height="270" rx="6" fill="#111827" />
      <rect x="272" y="90" width="96" height="36" rx="2" fill="#cbd5e1" stroke="#94a3b8" />
      {[100, 108, 116].map((y) => (
        <line key={y} x1="278" y1={y} x2="358" y2={y} stroke="#475569" strokeWidth="1.5" />
      ))}
      <rect x="272" y="156" width="96" height="48" rx="3" fill="#064e3b" stroke="#10b981" />
      <rect x="274" y="232" width="92" height="40" rx="3" fill="#0b0f19" stroke="#64748b" />
      {[290, 310, 330, 350].map((x) => (
        <path key={x} d={`M${x} 266 q6 -14 0 -24 q-6 10 0 24`} stroke="#3b82f6" fill="#1d4ed8" />
      ))}
      <rect x="426" y="102" width="52" height="52" rx="4" fill="#1f2937" stroke="#64748b" />
      <rect x="444" y="114" width="16" height="28" rx="2" fill="#0b0f19" stroke="#94a3b8" />
      <path d="M180 300 h60 M400 300 h60" stroke="#78716c" strokeWidth="6" />
    </g>
  );
}

export function PovFrame({ tech }: { tech: Technician }) {
  const kind = tech.equipment.kind;
  const step = tech.status === "completed" ? null : TARGETS[kind][tech.currentStep];
  const tone = tech.status === "escalated" ? "#ef4444" : tech.status === "safety_hold" ? "#f59e0b" : "#10b981";
  const chips = tech.readings.slice(-2);

  return (
    <div className="relative aspect-video overflow-hidden rounded-xl border border-line bg-[#05070d]">
      <svg viewBox="0 0 640 360" className="absolute inset-0 h-full w-full" role="img" aria-label={`Latest camera frame: ${tech.equipment.brand} ${tech.equipment.model}`}>
        <defs>
          <radialGradient id="vignette" cx="50%" cy="50%" r="70%">
            <stop offset="60%" stopColor="#000" stopOpacity="0" />
            <stop offset="100%" stopColor="#000" stopOpacity="0.75" />
          </radialGradient>
          <pattern id="scan" width="4" height="4" patternUnits="userSpaceOnUse">
            <rect width="4" height="1" fill="#ffffff" opacity="0.025" />
          </pattern>
        </defs>
        {kind === "rtu" ? <RooftopUnit /> : kind === "furnace" ? <Furnace /> : <Condenser heatPump={kind === "heat_pump"} />}
        {step && (
          <g>
            <rect x={step.x} y={step.y} width={step.w} height={step.h} fill="none" stroke={tone} strokeWidth="2.5" strokeDasharray="8 5" rx="4" />
            <rect x={step.x} y={step.y - 20} width={step.label.length * 7.4 + 14} height="18" rx="3" fill={tone} />
            <text x={step.x + 7} y={step.y - 7} fontSize="11" fontWeight="700" fontFamily="monospace" fill="#0b0f19">
              {step.label}
            </text>
          </g>
        )}
        <rect width="640" height="360" fill="url(#scan)" />
        <rect width="640" height="360" fill="url(#vignette)" />
      </svg>

      <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-2 p-2.5 font-mono text-[10px] text-slate-200">
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded bg-black/60 px-2 py-1">
          <span className={`h-1.5 w-1.5 rounded-full ${tech.status === "completed" ? "bg-muted" : "animate-pulse bg-danger"}`} />
          {tech.status === "completed" ? "SESSION ENDED" : (
            <>
              LIVE<span className="hidden sm:inline"> · POV CAM</span> · 1 FPS
            </>
          )}
        </span>
        <span className="whitespace-nowrap rounded bg-black/60 px-2 py-1">
          {tech.truck} · T+{formatElapsed(tech.elapsedSec)}
        </span>
      </div>

      <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-end justify-between gap-2 p-2.5">
        <span
          className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 font-mono text-[10px] font-bold tracking-wider ${
            tech.safetyVerified ? "bg-emerald/90 text-slate-deep" : "bg-danger/90 text-white"
          }`}
        >
          {tech.safetyVerified ? <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" /> : <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />}
          {tech.safetyVerified ? (
            <>
              <span className="hidden sm:inline">SAFETY </span>DISCONNECT VERIFIED
            </>
          ) : (
            <>
              DISCONNECT NOT VERIFIED<span className="hidden sm:inline"> · ELECTRICAL LOCKED</span>
            </>
          )}
        </span>
        <span className="hidden gap-1.5 sm:flex">
          {chips.map((r) => (
            <span key={r.id} className="rounded bg-black/70 px-1.5 py-0.5 font-mono text-[10px] text-slate-100">
              {r.short} {r.value}
              {r.unit.startsWith("°") ? "" : " "}
              {r.unit}
            </span>
          ))}
        </span>
      </div>
    </div>
  );
}
