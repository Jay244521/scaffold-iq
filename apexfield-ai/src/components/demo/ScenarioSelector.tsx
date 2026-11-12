import { ArrowRight, Building2, Home, Wind, type LucideIcon } from "lucide-react";
import { SCENARIOS, type ScenarioId } from "@/lib/demo-scenarios";

const ICONS: Record<ScenarioId, LucideIcon> = { A: Home, B: Wind, C: Building2 };

export function ScenarioSelector({ onSelect }: { onSelect: (id: ScenarioId) => void }) {
  return (
    <section aria-labelledby="scenario-heading" className="animate-fade-up">
      <p className="font-mono text-[13px] tracking-[0.1em] text-amber">STAGE 0 · SELECT A SERVICE CALL</p>
      <h1 id="scenario-heading" className="mt-3 text-3xl font-extrabold tracking-tight sm:text-[2.6rem] sm:leading-tight">
        Run a real diagnostic call, start to finish.
      </h1>
      <p className="mt-3 max-w-2xl text-lg leading-relaxed text-muted">
        Pick a call. You play the tech. ApexField reads the plate, enforces the safety gate, checks every reading against
        OEM spec, and writes the dispatch report.
      </p>

      <div className="mt-10 grid grid-cols-1 gap-5 lg:grid-cols-3">
        {SCENARIOS.map((s) => {
          const Icon = ICONS[s.id];
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onSelect(s.id)}
              className="group flex flex-col gap-5 rounded-3xl border border-line bg-steel p-6 text-left transition-all duration-200 hover:-translate-y-1 hover:border-amber/70 hover:shadow-[0_24px_60px_-30px_rgba(245,158,11,0.5)]"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber/12 text-amber">
                  <Icon className="h-6 w-6" aria-hidden="true" />
                </span>
                <span className="font-mono text-xs text-muted">SCENARIO {s.id}</span>
              </div>
              <div>
                <h2 className="text-xl font-bold">{s.name}</h2>
                <p className="mt-1 text-sm font-medium text-amber-hi">{s.category}</p>
              </div>
              <dl className="grid grid-cols-2 gap-2 font-mono text-[12px]">
                <div className="col-span-2 rounded-lg border border-line bg-slate-deep px-3 py-2">
                  <dt className="text-muted">EQUIPMENT</dt>
                  <dd className="text-ink">
                    {s.equipment.manufacturer.toUpperCase()} {s.equipment.model}
                  </dd>
                </div>
                <div className="rounded-lg border border-line bg-slate-deep px-3 py-2">
                  <dt className="text-muted">SIZE · REFRIG</dt>
                  <dd className="text-ink">
                    {s.equipment.tonnage} · {s.equipment.refrigerant}
                  </dd>
                </div>
                <div className="rounded-lg border border-line bg-slate-deep px-3 py-2">
                  <dt className="text-muted">{s.equipment.keySpec.label.toUpperCase()}</dt>
                  <dd className="text-ink">{s.equipment.keySpec.value}</dd>
                </div>
              </dl>
              <div className="flex-1 rounded-xl border border-gauge/40 bg-gauge/10 p-3">
                <p className="font-mono text-[10.5px] font-bold tracking-[0.1em] text-gauge">REPORTED SYMPTOM</p>
                <p className="mt-1 text-[14px] leading-snug text-slate-200">“{s.symptom}”</p>
              </div>
              <span className="inline-flex items-center gap-2 text-sm font-bold text-amber">
                Take this call <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
