"use client";

import { useState } from "react";
import {
  ClipboardCheck,
  Copy,
  Mic,
  ScanLine,
  ShieldCheck,
  TriangleAlert,
  CircleCheck,
  type LucideIcon,
} from "lucide-react";
import { SectionHeading } from "./SectionHeading";

type Stage = {
  id: string;
  icon: LucideIcon;
  title: string;
  summary: string;
  bullets: string[];
};

const STAGES: Stage[] = [
  {
    id: "scan",
    icon: ScanLine,
    title: "Instant OEM Data-Plate Recognition",
    summary:
      "Point the camera at the condenser or air handler. ApexField extracts the model, serial and refrigerant type, then loads the exact OEM charging chart and wiring diagram before the tech pulls a single gauge.",
    bullets: ["Manufacturer, model & serial", "R-410A · R-454B · R-32 · R-22", "OEM charging chart + wiring diagram"],
  },
  {
    id: "guide",
    icon: Mic,
    title: "Hands-Free Voice & Vision Guidance",
    summary:
      "Low-latency bidirectional voice plus live frame inspection walks the tech step-by-step through a deterministic diagnostic sequence, from 24V controls to contactor, capacitor and refrigerant circuit.",
    bullets: ["Talks through earbuds, gloves stay on", "Sees what the tech sees", "Deterministic diagnostic sequence"],
  },
  {
    id: "safety",
    icon: ShieldCheck,
    title: "Hard Safety Guardrails",
    summary:
      "Before any high-voltage step, vision verification confirms the power disconnect is pulled and multimeter probes are placed correctly. Anything unsafe triggers an instant voice interrupt.",
    bullets: ["Disconnect state verified on camera", "Probe placement & meter scale checked", "Instant voice interrupt"],
  },
  {
    id: "report",
    icon: ClipboardCheck,
    title: "Automated Telemetry & Dispatch Reporting",
    summary:
      "The tech speaks live readings out loud. ApexField validates each one against OEM spec and outputs a copy-paste-ready summary for ServiceTitan, Housecall Pro or Jobber.",
    bullets: ["Spoken readings become structured data", "Validated against OEM spec", "ServiceTitan · Housecall Pro · Jobber"],
  },
];

export function HowItWorks() {
  const [active, setActive] = useState(0);
  const stage = STAGES[active];

  return (
    <section id="how-it-works" aria-labelledby="how-heading" className="mx-auto max-w-7xl px-5 py-24 sm:px-8 lg:py-32">
      <SectionHeading id="how-heading" eyebrow="HOW IT WORKS · 4-STAGE PRODUCT ENGINE" title="A master tech standing over every shoulder.">
        No 400-page PDFs on a ladder. No squinting at microscopic schematics with gloves on. Your tech scans, listens and
        works. ApexField handles the rest.
      </SectionHeading>

      <div className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        {/* Stage selector */}
        <div role="tablist" aria-label="Product stages" aria-orientation="vertical" className="flex flex-col gap-3">
          {STAGES.map((s, i) => {
            const selected = i === active;
            const Icon = s.icon;
            return (
              <button
                key={s.id}
                type="button"
                role="tab"
                id={`tab-${s.id}`}
                aria-selected={selected}
                aria-controls={`panel-${s.id}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => setActive(i)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown" || e.key === "ArrowRight") {
                    e.preventDefault();
                    const next = (i + 1) % STAGES.length;
                    setActive(next);
                    document.getElementById(`tab-${STAGES[next].id}`)?.focus();
                  }
                  if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
                    e.preventDefault();
                    const prev = (i - 1 + STAGES.length) % STAGES.length;
                    setActive(prev);
                    document.getElementById(`tab-${STAGES[prev].id}`)?.focus();
                  }
                }}
                className={`group flex items-start gap-4 rounded-2xl border p-5 text-left transition-all duration-200 ${
                  selected
                    ? "border-amber bg-steel-2 shadow-[0_0_0_1px_rgba(245,158,11,0.3),0_20px_40px_-20px_rgba(245,158,11,0.35)]"
                    : "border-line bg-steel hover:border-line-strong"
                }`}
              >
                <span
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors ${
                    selected ? "bg-amber text-slate-deep" : "bg-slate-deep text-amber"
                  }`}
                >
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="flex flex-col gap-1">
                  <span className="font-mono text-xs text-muted">STAGE 0{i + 1}</span>
                  <span className="text-[17px] font-bold leading-snug">{s.title}</span>
                </span>
              </button>
            );
          })}
        </div>

        {/* Panel */}
        <div
          role="tabpanel"
          id={`panel-${stage.id}`}
          aria-labelledby={`tab-${stage.id}`}
          className="flex flex-col gap-6 rounded-3xl border border-line bg-steel p-6 sm:p-8"
        >
          <div key={stage.id} className="animate-fade-up flex flex-col gap-6">
            <div>
              <h3 className="text-2xl font-extrabold tracking-tight sm:text-[1.75rem]">{stage.title}</h3>
              <p className="mt-3 text-base leading-relaxed text-slate-300">{stage.summary}</p>
            </div>
            <ul className="flex flex-wrap gap-2">
              {stage.bullets.map((b) => (
                <li
                  key={b}
                  className={`rounded-lg border px-3 py-1.5 font-mono text-xs ${
                    stage.id === "safety"
                      ? "border-emerald/40 bg-emerald/10 text-emerald"
                      : "border-amber/35 bg-amber/10 text-amber-hi"
                  }`}
                >
                  {b}
                </li>
              ))}
            </ul>
            <StagePreview id={stage.id} />
          </div>
        </div>
      </div>
    </section>
  );
}

function StagePreview({ id }: { id: string }) {
  const frame = "rounded-2xl border border-line bg-slate-deep p-5 font-mono text-[13px]";

  if (id === "scan") {
    const rows: [string, string][] = [
      ["MANUFACTURER", "Carrier"],
      ["MODEL", "24ACC636A003"],
      ["SERIAL", "2419E08712"],
      ["REFRIGERANT", "R-410A"],
      ["TONNAGE", "3.0"],
    ];
    return (
      <div className={frame}>
        <p className="mb-4 text-[11px] tracking-[0.1em] text-muted">OCR EXTRACTION · CONFIDENCE 0.98</p>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-2.5 sm:grid-cols-2">
          {rows.map(([k, v]) => (
            <div key={k} className="flex items-center justify-between border-b border-line pb-2">
              <dt className="text-muted">{k}</dt>
              <dd className="text-ink">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-4 flex flex-wrap gap-2 text-[11px]">
          {["Service Manual", "Charging Chart", "Wiring Diagram"].map((d) => (
            <span key={d} className="flex items-center gap-1.5 rounded-md bg-emerald/10 px-2 py-1 text-emerald">
              <CircleCheck className="h-3.5 w-3.5" aria-hidden="true" /> {d} loaded
            </span>
          ))}
        </div>
      </div>
    );
  }

  if (id === "guide") {
    const lines: { who: "TECH" | "APEX"; text: string }[] = [
      { who: "TECH", text: "Contactor's pulled in. Compressor's humming but won't start." },
      { who: "APEX", text: "Classic weak run cap. Pull the disconnect, then set your meter to microfarads." },
      { who: "TECH", text: "Reading 38 on HERM to C." },
      { who: "APEX", text: "Rated 45 µF ±6%. That's out of spec. Replace the cap, then retest amp draw." },
    ];
    return (
      <div className={`${frame} flex flex-col gap-3`}>
        <p className="text-[11px] tracking-[0.1em] text-muted">LIVE SESSION · STEP 4 OF 9</p>
        {lines.map((l, i) => (
          <div key={i} className="flex gap-3">
            <span className={`w-12 shrink-0 text-xs font-bold ${l.who === "APEX" ? "text-amber" : "text-muted"}`}>{l.who}</span>
            <span className="leading-relaxed text-slate-200">{l.text}</span>
          </div>
        ))}
      </div>
    );
  }

  if (id === "safety") {
    return (
      <div className={`${frame} flex flex-col gap-3`}>
        <p className="text-[11px] tracking-[0.1em] text-muted">SAFETY GATE · HIGH-VOLTAGE STEP</p>
        <div className="flex items-start gap-3 rounded-xl border border-gauge/50 bg-gauge/10 p-3 text-amber-hi">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>INTERRUPT — Disconnect still seated. Pull it before opening the panel.</span>
        </div>
        {[
          "Service disconnect pulled",
          "Meter set to VAC, 600V scale",
          "Probes on L1 / L2 line side",
        ].map((c) => (
          <div key={c} className="flex items-center gap-3 rounded-xl border border-emerald/30 bg-emerald/5 p-3 text-emerald">
            <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{c}</span>
            <span className="ml-auto text-[11px] font-bold">VERIFIED</span>
          </div>
        ))}
      </div>
    );
  }

  return <ReportPreview />;
}

function ReportPreview() {
  const [copied, setCopied] = useState(false);
  const report = `JOB SUMMARY — Carrier 24ACC636A003 (R-410A, 3.0 Ton)
Complaint: No cooling, compressor hum, no start.
Readings: Suction 118 psi | Liquid 342 psi | SC 4.2°F (target 10°F)
Run cap: 38 µF measured / 45 µF ±6% rated — FAIL
Action: Replaced 45/5 µF dual run capacitor. Disconnect verified pulled.
Recommend: Verify charge after airflow check; inspect TXV bulb insulation.`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(report);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="rounded-2xl border border-line bg-slate-deep p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="font-mono text-[11px] tracking-[0.1em] text-muted">FSM EXPORT · READY TO PASTE</p>
        <button
          type="button"
          onClick={copy}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-line-strong px-3 font-mono text-xs text-ink transition-colors hover:border-amber hover:text-amber"
        >
          {copied ? <CircleCheck className="h-3.5 w-3.5 text-emerald" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="whitespace-pre-wrap font-mono text-[12.5px] leading-relaxed text-slate-200">{report}</pre>
    </div>
  );
}
