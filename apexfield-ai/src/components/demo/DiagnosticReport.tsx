"use client";

import { useEffect, useRef, useState } from "react";
import { CircleCheck, ClipboardCopy, RotateCcw, ShieldCheck, TriangleAlert, Wrench } from "lucide-react";
import { buildReportText, type LogEntry, type Scenario } from "@/lib/demo-scenarios";
import { DemoButton } from "@/components/landing/DemoModal";
import { StatusBadge } from "./TelemetryLog";

export function DiagnosticReport({
  scenario,
  logs,
  safetyTime,
  confirmed,
  generatedAt,
  onRestart,
}: {
  scenario: Scenario;
  logs: LogEntry[];
  safetyTime: string | null;
  confirmed: boolean;
  generatedAt: string;
  onRestart: () => void;
}) {
  const [toast, setToast] = useState<"copied" | "failed" | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const e = scenario.equipment;
  const rc = confirmed ? scenario.rootCause : scenario.unconfirmed;

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const copy = async () => {
    const text = buildReportText({ scenario, logs, safetyTime, confirmed, generatedAt });
    try {
      await navigator.clipboard.writeText(text);
      setToast("copied");
    } catch {
      setToast("failed");
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 2200);
  };

  return (
    <section aria-labelledby="report-heading" className="animate-fade-up flex flex-col gap-6">
      {/* Banner */}
      <div
        className={`rounded-3xl border-2 p-6 sm:p-8 ${
          confirmed ? "border-emerald bg-gradient-to-br from-emerald/15 to-transparent" : "border-amber bg-gradient-to-br from-amber/15 to-transparent"
        }`}
      >
        <p className={`flex items-center gap-2 font-mono text-[12px] font-bold tracking-[0.1em] ${confirmed ? "text-emerald" : "text-amber"}`}>
          {confirmed ? <CircleCheck className="h-4 w-4" aria-hidden="true" /> : <TriangleAlert className="h-4 w-4" aria-hidden="true" />}
          {confirmed ? "DIAGNOSTIC COMPLETE — ROOT CAUSE CONFIRMED" : "DIAGNOSTIC COMPLETE — ROOT CAUSE NOT CONFIRMED"}
        </p>
        <h1 id="report-heading" className="mt-3 text-2xl font-extrabold tracking-tight sm:text-4xl">
          {rc.title}
        </h1>
        <p className="mt-3 max-w-3xl text-base leading-relaxed text-slate-300">{rc.fix}</p>
        {!confirmed && (
          <p className="mt-3 text-sm text-muted">
            Your logged readings didn&apos;t match this call&apos;s fault pattern, so ApexField won&apos;t guess. Reset and try the
            voice readings to see the confirmed path.
          </p>
        )}
      </div>

      {/* Dispatch summary */}
      <div className="rounded-3xl border border-line bg-steel">
        <div className="flex flex-col gap-3 border-b border-line p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div>
            <p className="font-mono text-[11px] tracking-[0.1em] text-muted">SERVICETITAN / HOUSECALL PRO</p>
            <h2 className="text-xl font-bold">Dispatch Summary</h2>
          </div>
          <button
            type="button"
            onClick={copy}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-line-strong px-4 text-sm font-bold text-ink transition-colors hover:border-amber hover:text-amber"
          >
            <ClipboardCopy className="h-4 w-4" aria-hidden="true" /> Copy Report to Clipboard
          </button>
        </div>

        <div className="grid grid-cols-1 gap-px bg-line lg:grid-cols-2">
          <ReportBlock title="EQUIPMENT">
            <p className="font-mono text-[13px] text-ink">
              {e.manufacturer.toUpperCase()} {e.model}
            </p>
            <p className="font-mono text-[12.5px] text-slate-300">S/N {e.serial}</p>
            <p className="font-mono text-[12.5px] text-slate-300">
              {e.tonnage} · {e.refrigerant} · {e.electrical}
            </p>
            <p className="font-mono text-[12.5px] text-slate-300">
              {e.keySpec.label}: {e.keySpec.value}
            </p>
            <p className="mt-2 text-[13px] text-muted">Symptom: “{scenario.symptom}”</p>
          </ReportBlock>

          <ReportBlock title="SAFETY VERIFICATION">
            <p className="flex items-center gap-2 font-mono text-[13px] font-bold text-emerald">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" /> Disconnect pulled · 0V AC verified L1/L2
            </p>
            <p className="font-mono text-[12.5px] text-slate-300">Timestamp: {safetyTime ?? "—"}</p>
            <p className="font-mono text-[12.5px] text-slate-300">Report generated: {generatedAt}</p>
          </ReportBlock>

          <ReportBlock title="LOGGED TELEMETRY" wide>
            <ul className="flex flex-col gap-2">
              {logs.flatMap((l) =>
                l.type === "reading"
                  ? l.readings.map((r) => (
                      <li
                        key={`${l.stepIndex}-${r.metricId}`}
                        className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2 font-mono text-[12.5px] last:border-0"
                      >
                        <span className="text-slate-300">
                          <span className="text-muted">[{l.time}]</span> {r.label}: <b className="text-ink">{r.display} {r.unit}</b>{" "}
                          <span className="text-muted">(spec {r.specLabel})</span>
                        </span>
                        <StatusBadge status={r.status} />
                      </li>
                    ))
                  : []
              )}
            </ul>
          </ReportBlock>

          <ReportBlock title={confirmed ? "CONFIRMED ROOT CAUSE" : "FINDING"}>
            <p className="text-[14px] font-semibold text-ink">{rc.title}</p>
          </ReportBlock>

          <ReportBlock title="RECOMMENDED PARTS">
            <ul className="flex flex-col gap-1.5">
              {rc.parts.map((p) => (
                <li key={p} className="flex gap-2 text-[14px] text-slate-200">
                  <Wrench className="mt-0.5 h-4 w-4 shrink-0 text-amber" aria-hidden="true" /> {p}
                </li>
              ))}
            </ul>
          </ReportBlock>
        </div>
      </div>

      {/* CTAs */}
      <div className="flex flex-col gap-3 rounded-3xl border border-line bg-steel p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
        <div>
          <h2 className="text-xl font-bold">That&apos;s one call. Picture it across every truck.</h2>
          <p className="mt-1 text-muted">See ApexField on your own equipment with your service manager.</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={onRestart}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-line-strong px-5 font-semibold text-ink transition-colors hover:border-amber hover:text-amber"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" /> Run Another Scenario
          </button>
          <DemoButton className="min-h-12 px-6">Book Live Fleet Demo</DemoButton>
        </div>
      </div>

      {/* Toast */}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
        {toast && (
          <div
            className={`animate-fade-up flex items-center gap-2 rounded-xl border px-4 py-3 font-semibold shadow-2xl ${
              toast === "copied" ? "border-emerald/60 bg-[#0F2A22] text-emerald" : "border-danger/60 bg-[#2A1215] text-danger"
            }`}
          >
            {toast === "copied" ? <CircleCheck className="h-5 w-5" aria-hidden="true" /> : <TriangleAlert className="h-5 w-5" aria-hidden="true" />}
            {toast === "copied" ? "Copied!" : "Couldn't access clipboard"}
          </div>
        )}
      </div>
    </section>
  );
}

function ReportBlock({ title, children, wide }: { title: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={`flex flex-col gap-1 bg-steel p-5 sm:p-6 ${wide ? "lg:col-span-2" : ""}`}>
      <p className="mb-2 font-mono text-[10.5px] font-bold tracking-[0.12em] text-amber">{title}</p>
      {children}
    </div>
  );
}
