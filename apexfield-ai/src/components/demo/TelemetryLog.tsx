import { Activity, ShieldCheck } from "lucide-react";
import type { LogEntry } from "@/lib/demo-scenarios";

export function StatusBadge({ status }: { status: "within" | "out" }) {
  return status === "within" ? (
    <span className="shrink-0 rounded bg-emerald/15 px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-wide text-emerald">
      WITHIN SPEC
    </span>
  ) : (
    <span className="shrink-0 rounded bg-gauge/20 px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-wide text-amber-hi">
      OUT OF SPEC
    </span>
  );
}

export function TelemetryLog({ logs }: { logs: LogEntry[] }) {
  return (
    <div className="rounded-2xl border border-line bg-steel p-5 sm:p-6">
      <p className="flex items-center gap-2 font-mono text-[11px] tracking-[0.1em] text-muted">
        <Activity className="h-3.5 w-3.5 text-amber" aria-hidden="true" /> LIVE TELEMETRY LOG
      </p>
      {logs.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-line-strong p-4 text-sm text-muted">
          No readings yet. Speak or log your first reading and it lands here, checked against OEM spec.
        </p>
      ) : (
        <ol className="mt-4 flex flex-col gap-3">
          {logs.map((l, i) => (
            <li key={i} className="animate-fade-up rounded-xl border border-line bg-slate-deep p-3.5">
              <div className="flex items-center justify-between gap-3 font-mono text-[11px] text-muted">
                <span>
                  STEP {l.stepIndex + 1} · {l.stepTitle}
                </span>
                <span>{l.time}</span>
              </div>
              {l.type === "safety" ? (
                <p className="mt-2 flex items-center gap-2 font-mono text-[12.5px] font-bold text-emerald">
                  <ShieldCheck className="h-4 w-4" aria-hidden="true" /> DISCONNECT PULLED · 0V AC VERIFIED L1/L2
                </p>
              ) : (
                <>
                  {l.source === "voice" && l.spoken && (
                    <p className="mt-2 text-[13px] italic text-slate-300">TECH: “{l.spoken}”</p>
                  )}
                  <ul className="mt-2 flex flex-col gap-1.5">
                    {l.readings.map((r) => (
                      <li key={r.metricId} className="flex flex-wrap items-center justify-between gap-2 font-mono text-[12.5px]">
                        <span className="text-slate-300">
                          {r.label}: <b className="text-ink">{r.display} {r.unit}</b>
                          <span className="text-muted"> / {r.specLabel}</span>
                        </span>
                        <StatusBadge status={r.status} />
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2.5 border-t border-line pt-2.5 text-[13px] leading-relaxed text-slate-300">
                    <span className="font-mono text-[11px] font-bold text-amber">APEX ▸ </span>
                    {l.reasoning}
                  </p>
                </>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
