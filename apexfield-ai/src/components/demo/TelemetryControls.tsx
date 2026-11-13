import { ArrowRight, Mic, Send } from "lucide-react";
import { metricStatus, type ReadingStep, type ReadingValues } from "@/lib/demo-scenarios";

export function TelemetryControls({
  step,
  values,
  onChange,
  onVoice,
  onLog,
  locked,
}: {
  step: ReadingStep;
  values: ReadingValues;
  onChange: (id: string, v: number) => void;
  onVoice: () => void;
  onLog: () => void;
  locked: boolean;
}) {
  return (
    <div className="rounded-2xl border border-line bg-steel p-5 sm:p-6">
      <p className="font-mono text-[11px] tracking-[0.1em] text-muted">TECHNICIAN CONTROLS</p>

      <button
        type="button"
        onClick={onVoice}
        disabled={locked}
        className="mt-3 flex min-h-14 w-full items-center gap-3 rounded-xl border border-amber/50 bg-amber/10 px-4 py-3 text-left transition-colors hover:bg-amber/15 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber text-slate-deep">
          <Mic className="h-4 w-4" aria-hidden="true" />
        </span>
        <span className="min-w-0">
          <span className="block font-mono text-[10.5px] font-bold tracking-[0.1em] text-amber">SIMULATE VOICE READING</span>
          <span className="block text-[14px] leading-snug text-slate-100">Speak: “{step.voiceChip}”</span>
        </span>
        <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-amber" aria-hidden="true" />
      </button>

      <div className="my-5 flex items-center gap-3 font-mono text-[11px] text-muted">
        <span className="h-px flex-1 bg-line" /> OR ENTER GAUGE READINGS <span className="h-px flex-1 bg-line" />
      </div>

      <div className="flex flex-col gap-5">
        {step.metrics.map((m) => {
          const v = values[m.id] ?? m.simulated;
          const status = metricStatus(m, v);
          const pct = ((v - m.min) / (m.max - m.min)) * 100;
          const id = `metric-${step.id}-${m.id}`;
          return (
            <div key={m.id} className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-3">
                <label htmlFor={id} className="text-sm font-semibold">
                  {m.label} <span className="font-mono text-xs font-normal text-muted">(spec {m.specLabel})</span>
                </label>
                <span className="flex items-center gap-1.5">
                  <input
                    type="number"
                    aria-label={`${m.label} value`}
                    min={m.min}
                    max={m.max}
                    step={m.step}
                    value={Number(v.toFixed(m.decimals))}
                    disabled={locked}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      if (!Number.isNaN(n)) onChange(m.id, Math.min(m.max, Math.max(m.min, n)));
                    }}
                    className={`w-24 rounded-md border bg-slate-deep px-2 py-1.5 text-right font-mono text-sm tabular-nums focus:outline-none ${
                      status === "within" ? "border-emerald/50 text-emerald" : "border-gauge/60 text-amber-hi"
                    }`}
                  />
                  <span className="w-14 font-mono text-xs text-muted">{m.unit}</span>
                </span>
              </div>
              <input
                id={id}
                type="range"
                min={m.min}
                max={m.max}
                step={m.step}
                value={v}
                disabled={locked}
                onChange={(e) => onChange(m.id, Number(e.target.value))}
                className="h-2 w-full cursor-pointer appearance-none rounded-full disabled:cursor-not-allowed [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-4 [&::-moz-range-thumb]:border-slate-deep [&::-moz-range-thumb]:bg-amber [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-4 [&::-webkit-slider-thumb]:border-slate-deep [&::-webkit-slider-thumb]:bg-amber"
                style={{ background: `linear-gradient(90deg, #F59E0B ${pct}%, #1E293B ${pct}%)` }}
              />
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={onLog}
        disabled={locked}
        className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-line-strong bg-slate-deep px-6 font-bold text-ink transition-colors hover:border-amber hover:text-amber disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Send className="h-4 w-4" aria-hidden="true" /> Log Reading to AI
      </button>
    </div>
  );
}
