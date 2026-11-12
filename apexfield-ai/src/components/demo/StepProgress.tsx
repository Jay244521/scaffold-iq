import { Check, Lock, ShieldCheck } from "lucide-react";
import type { DiagnosticStep } from "@/lib/demo-scenarios";

export type StepState = "done-within" | "done-out" | "done-safety" | "active" | "upcoming";

export function StepProgress({ steps, states }: { steps: DiagnosticStep[]; states: StepState[] }) {
  return (
    <ol aria-label="Diagnostic steps" className="grid grid-cols-4 gap-2">
      {steps.map((s, i) => {
        const st = states[i];
        const ring =
          st === "active"
            ? "border-amber bg-amber/10 text-amber"
            : st === "done-within" || st === "done-safety"
              ? "border-emerald/60 bg-emerald/10 text-emerald"
              : st === "done-out"
                ? "border-gauge/70 bg-gauge/10 text-amber-hi"
                : "border-line bg-steel text-muted";
        return (
          <li
            key={s.id}
            aria-current={st === "active" ? "step" : undefined}
            className={`flex min-h-[64px] flex-col justify-between gap-1 rounded-xl border p-2.5 transition-colors sm:p-3 ${ring}`}
          >
            <span className="flex items-center justify-between font-mono text-[10.5px] font-bold">
              STEP {i + 1}
              {st === "done-safety" ? (
                <ShieldCheck className="h-3.5 w-3.5" aria-label="verified" />
              ) : st.startsWith("done") ? (
                <Check className="h-3.5 w-3.5" aria-label="complete" />
              ) : st === "upcoming" && s.kind === "safety" ? (
                <Lock className="h-3.5 w-3.5" aria-label="safety gate" />
              ) : null}
            </span>
            <span className="hidden text-[12px] font-semibold leading-tight text-slate-200 sm:block">{s.title}</span>
          </li>
        );
      })}
    </ol>
  );
}
