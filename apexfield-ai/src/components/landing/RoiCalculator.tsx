"use client";

import { useMemo, useState } from "react";
import { Clock, DollarSign, TrendingUp, Truck } from "lucide-react";
import { SectionHeading } from "./SectionHeading";
import { DemoButton } from "./DemoModal";

const CALLBACK_REDUCTION = 0.4;
const SENIOR_HOURS_PER_WEEK = 6;
const JUNIORS_PER_SENIOR = 4;
const GROWTH_FLEET_PRICE = 119;
const WEEKS_PER_YEAR = 52;

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const num = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

export function RoiCalculator() {
  const [juniors, setJuniors] = useState(8);
  const [callbacks, setCallbacks] = useState(6);
  const [cost, setCost] = useState(325);

  const r = useMemo(() => {
    const avoidedPerYear = callbacks * WEEKS_PER_YEAR * CALLBACK_REDUCTION;
    const annualSavings = avoidedPerYear * cost;
    const seniors = Math.max(1, Math.ceil(juniors / JUNIORS_PER_SENIOR));
    const hoursReclaimed = seniors * SENIOR_HOURS_PER_WEEK * WEEKS_PER_YEAR;
    const annualSubscription = juniors * GROWTH_FLEET_PRICE * 12;
    const roiMultiple = annualSubscription > 0 ? annualSavings / annualSubscription : 0;
    return { avoidedPerYear, annualSavings, seniors, hoursReclaimed, annualSubscription, roiMultiple };
  }, [juniors, callbacks, cost]);

  return (
    <section id="roi" aria-labelledby="roi-heading" className="border-y border-line bg-[#0E1320]">
      <div className="mx-auto max-w-7xl px-5 py-24 sm:px-8 lg:py-32">
        <SectionHeading id="roi-heading" eyebrow="FLEET ROI CALCULATOR" title="Run the numbers on your own fleet.">
          Every callback and second truck roll comes straight off your margin. Move the sliders to see what cutting them
          is worth.
        </SectionHeading>

        <div className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Inputs */}
          <div className="flex flex-col gap-9 rounded-3xl border border-line bg-steel p-6 sm:p-8">
            <Slider
              id="roi-juniors"
              label="Number of Junior / Apprentice Techs"
              min={1}
              max={50}
              step={1}
              value={juniors}
              onChange={setJuniors}
              format={(v) => num.format(v)}
            />
            <Slider
              id="roi-callbacks"
              label="Avg. Callbacks / Second-Truck Dispatches per Week (Fleet-Wide)"
              min={1}
              max={30}
              step={1}
              value={callbacks}
              onChange={setCallbacks}
              format={(v) => num.format(v)}
            />
            <Slider
              id="roi-cost"
              label="Avg. Cost per Truck Roll / Callback"
              min={150}
              max={600}
              step={5}
              value={cost}
              onChange={setCost}
              format={(v) => usd.format(v)}
            />
            <p className="border-t border-line pt-5 text-[13px] leading-relaxed text-muted">
              Assumes a conservative {CALLBACK_REDUCTION * 100}% reduction in callbacks and second-truck dispatches,{" "}
              {SENIOR_HOURS_PER_WEEK} hours/week reclaimed per senior tech (one senior per {JUNIORS_PER_SENIOR} apprentices),
              and Growth Fleet pricing at ${GROWTH_FLEET_PRICE}/tech/mo. Estimates only.
            </p>
          </div>

          {/* Outputs */}
          <div aria-live="polite" className="flex flex-col gap-4 rounded-3xl border border-amber/70 bg-steel p-6 shadow-[0_30px_80px_-40px_rgba(245,158,11,0.5)] sm:p-8">
            <div>
              <p className="flex items-center gap-2 font-mono text-xs tracking-[0.1em] text-muted">
                <DollarSign className="h-4 w-4 text-amber" aria-hidden="true" /> EST. ANNUAL DIRECT CALLBACK SAVINGS
              </p>
              <p className="mt-2 bg-gradient-to-r from-amber to-gauge bg-clip-text font-mono text-5xl font-bold tracking-tight text-transparent tabular-nums sm:text-6xl">
                {usd.format(r.annualSavings)}
              </p>
              <p className="mt-2 font-mono text-sm text-muted">
                {num.format(r.avoidedPerYear)} truck rolls avoided per year
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <OutputCard
                icon={Clock}
                label="Senior Tech Hours Reclaimed / Year"
                value={num.format(r.hoursReclaimed)}
                sub={`${r.seniors} senior tech${r.seniors === 1 ? "" : "s"} × ${SENIOR_HOURS_PER_WEEK} hrs/wk`}
                tone="emerald"
              />
              <OutputCard
                icon={TrendingUp}
                label="Net ROI Multiple"
                value={`${r.roiMultiple.toFixed(1)}×`}
                sub={`vs. ${usd.format(r.annualSubscription)}/yr Growth Fleet`}
                tone={r.roiMultiple >= 1 ? "emerald" : "amber"}
              />
            </div>

            <div className="mt-auto flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="flex items-center gap-2 text-sm text-muted">
                <Truck className="h-4 w-4 text-amber" aria-hidden="true" /> Want this modeled on your real job data?
              </p>
              <DemoButton className="min-h-12 px-6 text-sm">Book a Live Field Demo</DemoButton>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Slider({
  id,
  label,
  min,
  max,
  step,
  value,
  onChange,
  format,
}: {
  id: string;
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
  format: (v: number) => string;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-4">
        <label htmlFor={id} className="text-[15px] font-semibold leading-snug">
          {label}
        </label>
        <output htmlFor={id} className="shrink-0 font-mono text-2xl font-bold text-amber tabular-nums">
          {format(value)}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-2 w-full cursor-pointer appearance-none rounded-full [&::-moz-range-thumb]:h-6 [&::-moz-range-thumb]:w-6 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-4 [&::-moz-range-thumb]:border-slate-deep [&::-moz-range-thumb]:bg-amber [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-4 [&::-webkit-slider-thumb]:border-slate-deep [&::-webkit-slider-thumb]:bg-amber [&::-webkit-slider-thumb]:shadow-[0_0_0_2px_#F59E0B]"
        style={{ background: `linear-gradient(90deg, #F59E0B ${pct}%, #1E293B ${pct}%)` }}
      />
      <div className="flex justify-between font-mono text-xs text-muted">
        <span>{format(min)}</span>
        <span>{format(max)}</span>
      </div>
    </div>
  );
}

function OutputCard({
  icon: Icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: typeof Clock;
  label: string;
  value: string;
  sub: string;
  tone: "emerald" | "amber";
}) {
  return (
    <div className="rounded-2xl border border-line bg-slate-deep p-5">
      <p className="flex items-center gap-2 text-sm text-muted">
        <Icon className={`h-4 w-4 ${tone === "emerald" ? "text-emerald" : "text-amber"}`} aria-hidden="true" />
        {label}
      </p>
      <p className={`mt-2 font-mono text-3xl font-bold tabular-nums ${tone === "emerald" ? "text-emerald" : "text-amber"}`}>
        {value}
      </p>
      <p className="mt-1 font-mono text-xs text-muted">{sub}</p>
    </div>
  );
}
