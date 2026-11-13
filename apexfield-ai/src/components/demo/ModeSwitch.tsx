"use client";

import { MonitorPlay, Radio } from "lucide-react";

export type DemoMode = "live" | "sim";

const OPTIONS: { id: DemoMode; label: string; short: string; hint: string; Icon: typeof Radio }[] = [
  { id: "live", label: "Live Camera & Voice (Real AI)", short: "Live AI", hint: "Gemini sees your camera and talks you through it", Icon: Radio },
  { id: "sim", label: "Guided Browser Simulator (No Mic/Cam)", short: "Simulator", hint: "Scripted call, works on any desktop", Icon: MonitorPlay },
];

export function ModeSwitch({ mode, onChange }: { mode: DemoMode; onChange: (m: DemoMode) => void }) {
  return (
    <div className="mb-5 sm:mb-8">
      <div role="radiogroup" aria-label="Demo mode" className="grid grid-cols-2 gap-1.5 rounded-2xl border border-line bg-steel p-1.5">
        {OPTIONS.map(({ id, label, short, hint, Icon }) => {
          const on = mode === id;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(id)}
              className={`flex min-h-14 items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors sm:px-4 ${
                on ? "bg-amber text-slate-deep" : "text-slate-300 hover:bg-steel-2 hover:text-ink"
              }`}
            >
              <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
              <span className="min-w-0">
                <span className="block text-sm font-bold">
                  <span className="sm:hidden">{short}</span>
                  <span className="hidden sm:inline">{label}</span>
                </span>
                <span className={`hidden text-xs md:block ${on ? "text-slate-deep/75" : "text-muted"}`}>{hint}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
