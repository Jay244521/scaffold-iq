import { Eye, Mic, Volume2, VolumeX } from "lucide-react";

const BARS = [30, 55, 40, 80, 50, 100, 65, 35, 85, 55, 95, 45, 75, 50, 100, 60, 40, 80, 45, 70, 35, 55, 30, 50, 70, 40];

export type CoachTone = "instruction" | "within" | "out" | "safety";

const TONE_STYLES: Record<CoachTone, { border: string; label: string; labelColor: string }> = {
  instruction: { border: "border-amber/60", label: "INSTRUCTION", labelColor: "text-amber" },
  safety: { border: "border-danger/70", label: "SAFETY HOLD", labelColor: "text-danger" },
  within: { border: "border-emerald/60", label: "WITHIN SPEC", labelColor: "text-emerald" },
  out: { border: "border-gauge/70", label: "OUT OF SPEC", labelColor: "text-gauge" },
};

export function VoiceCoachPanel({
  stepLabel,
  stepTitle,
  message,
  tone,
  vision,
  visionVerified,
  speech,
  active,
}: {
  stepLabel: string;
  stepTitle: string;
  message: string;
  tone: CoachTone;
  vision: string[];
  visionVerified: boolean;
  speech: { supported: boolean; enabled: boolean; speaking: boolean; onToggle: () => void };
  active: boolean;
}) {
  const t = TONE_STYLES[tone];
  const animate = speech.speaking || active;

  return (
    <div className="flex flex-col gap-4">
      {/* Live vision feed */}
      <div className="overflow-hidden rounded-2xl border border-line bg-[#05070D]">
        <div className="flex items-center justify-between border-b border-line px-4 py-2.5 font-mono text-[11px] text-muted">
          <span className="flex items-center gap-2">
            <Eye className="h-3.5 w-3.5 text-amber" aria-hidden="true" /> LIVE VISION · FRAME ANALYSIS
          </span>
          <span className="flex items-center gap-1.5 text-emerald">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald" /> LIVE
          </span>
        </div>
        <div className="relative min-h-[150px] p-4">
          <div
            aria-hidden="true"
            className="absolute inset-0 opacity-60 [background:repeating-linear-gradient(0deg,transparent_0_3px,rgba(30,41,59,0.35)_3px_4px)]"
          />
          <ul className="relative flex flex-col gap-2" aria-label="Detected in camera frame">
            {vision.map((v, i) => (
              <li
                key={`${stepTitle}-${v}`}
                style={{ animationDelay: `${i * 120}ms` }}
                className={`animate-fade-up flex items-center gap-2 rounded-lg border px-3 py-2 font-mono text-[12px] ${
                  visionVerified
                    ? "border-emerald/35 bg-emerald/10 text-emerald"
                    : "border-amber/30 bg-slate-deep/80 text-slate-200"
                }`}
              >
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${visionVerified ? "bg-emerald" : "bg-amber"}`} />
                {v}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Voice coach */}
      <div className={`rounded-2xl border-2 bg-steel p-5 transition-colors ${t.border}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-center gap-2 font-mono text-[11px] tracking-[0.1em] text-muted">
            <Mic className="h-3.5 w-3.5 text-amber" aria-hidden="true" /> AI VOICE COACH · {stepLabel}
          </p>
          {speech.supported ? (
            <button
              type="button"
              onClick={speech.onToggle}
              aria-pressed={speech.enabled}
              className={`inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 font-mono text-[11px] font-bold tracking-wide transition-colors ${
                speech.enabled
                  ? "border-amber bg-amber text-slate-deep"
                  : "border-line-strong text-slate-300 hover:border-amber hover:text-amber"
              }`}
            >
              {speech.enabled ? <Volume2 className="h-4 w-4" aria-hidden="true" /> : <VolumeX className="h-4 w-4" aria-hidden="true" />}
              VOICE AUDIO {speech.enabled ? "ON" : "OFF"}
            </button>
          ) : (
            <span className="font-mono text-[11px] text-muted">Voice audio unavailable in this browser</span>
          )}
        </div>

        <p className={`mt-4 font-mono text-[11px] font-bold tracking-[0.1em] ${t.labelColor}`}>{t.label}</p>
        <h2 className="mt-1 text-lg font-bold">{stepTitle}</h2>
        <p aria-live="polite" className="mt-2 text-[17px] font-semibold leading-relaxed text-ink">
          “{message}”
        </p>

        <div aria-hidden="true" className="mt-5 flex h-10 items-center gap-[3px]">
          {BARS.map((h, i) => (
            <span
              key={i}
              className={`block flex-1 rounded-sm bg-gradient-to-t from-gauge to-amber transition-opacity ${
                animate ? "animate-wave opacity-100" : "opacity-30"
              }`}
              style={{ height: animate ? `${h}%` : "15%", animationDelay: `-${(i * 0.06).toFixed(2)}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
