"use client";

import Link from "next/link";
import { ArrowRight, Check, Mic, PlayCircle, ScanLine, ShieldCheck, TriangleAlert } from "lucide-react";
import { DemoButton } from "./DemoModal";

const WAVE_HEIGHTS = [35, 60, 45, 85, 55, 100, 70, 40, 90, 60, 95, 50, 80, 55, 100, 65, 45, 85, 50, 75, 40, 60, 30, 55];

const TRUST = ["Works on iOS & Android", "Zero Proprietary Hardware", "ServiceTitan & Housecall Pro Ready"];

export function HeroSection() {
  return (
    <section id="top" className="relative overflow-hidden">
      {/* Background grid + glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.35] [background-image:linear-gradient(#1E293B_1px,transparent_1px),linear-gradient(90deg,#1E293B_1px,transparent_1px)] [background-size:56px_56px] [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_75%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 right-0 h-[520px] w-[520px] rounded-full bg-amber/10 blur-[120px]"
      />

      <div className="relative mx-auto grid max-w-7xl grid-cols-1 items-center gap-14 px-5 pb-20 pt-14 sm:px-8 lg:grid-cols-2 lg:gap-12 lg:pb-28 lg:pt-20">
        {/* Left */}
        <div className="flex flex-col gap-6">
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-line bg-steel px-3 py-1.5 font-mono text-[11px] tracking-[0.08em] text-muted sm:text-xs">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald" />
            </span>
            BUILT FOR HVAC FLEETS • DFW, TEXAS
          </span>

          <h1 className="text-[2.6rem] font-extrabold leading-[1.02] tracking-[-0.035em] sm:text-6xl lg:text-[4.25rem]">
            Every Technician,
            <br />
            <span className="bg-gradient-to-r from-amber to-gauge bg-clip-text text-transparent">
              A Master Technician.
            </span>
          </h1>

          <p className="max-w-xl text-lg leading-relaxed text-muted sm:text-[19px]">
            Real-time multimodal AI field coaching that sees what your technicians see, reads OEM equipment
            automatically, and talks them through complex HVAC diagnostics and repairs—turning day-one hires into
            autonomous, high-margin technicians.
          </p>

          <div className="flex flex-col gap-3 pt-2 sm:flex-row">
            <DemoButton className="min-h-13 px-7 py-3.5 text-base">
              Book a Live Field Demo <ArrowRight className="h-5 w-5" />
            </DemoButton>
            <Link
              href="/demo"
              className="inline-flex min-h-13 items-center justify-center gap-2 rounded-xl border border-line-strong bg-steel px-7 py-3.5 text-base font-semibold text-ink transition-colors hover:border-amber/60 hover:bg-steel-2"
            >
              <PlayCircle className="h-5 w-5 text-amber" aria-hidden="true" />
              Try Interactive Field Demo
            </Link>
          </div>

          <ul className="flex flex-col gap-2.5 pt-3 text-sm text-muted sm:flex-row sm:flex-wrap sm:gap-x-6">
            {TRUST.map((t) => (
              <li key={t} className="flex items-center gap-2">
                <Check className="h-4 w-4 text-emerald" strokeWidth={3} aria-hidden="true" />
                {t}
              </li>
            ))}
          </ul>
        </div>

        {/* Right: phone HUD */}
        <div className="flex justify-center lg:justify-end">
          <FieldHud />
        </div>
      </div>
    </section>
  );
}

function FieldHud() {
  return (
    <div
      role="img"
      aria-label="ApexField session on a phone: Carrier 3-ton R-410A condenser identified, disconnect verified, subcooling flagged low at 4.2 degrees, AI voice guidance active"
      className="relative w-full max-w-[380px]"
    >
      <div aria-hidden="true" className="absolute -inset-6 rounded-[56px] bg-gradient-to-b from-amber/15 to-transparent blur-2xl" />
      <div className="relative overflow-hidden rounded-[44px] border-[10px] border-[#1E293B] bg-[#05070D] shadow-[0_40px_100px_-20px_rgba(0,0,0,0.8)]">
        {/* status notch */}
        <div className="flex items-center justify-between px-6 pb-2 pt-3 font-mono text-[10px] text-muted">
          <span>SESSION 00:07:42</span>
          <span className="flex items-center gap-1.5 text-emerald">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald" /> LIVE
          </span>
        </div>

        {/* camera view with plate */}
        <div className="relative mx-3 h-40 overflow-hidden rounded-2xl bg-[#1A2130]">
          <div
            aria-hidden="true"
            className="absolute inset-0 [background:repeating-linear-gradient(90deg,#1A2130_0_12px,#202839_12px_14px)]"
          />
          <div className="absolute left-1/2 top-1/2 w-[78%] -translate-x-1/2 -translate-y-1/2 -rotate-2 rounded-md bg-[#C7CCD3] px-3 py-2.5 font-mono text-[9.5px] leading-[1.55] text-[#1F2937] shadow-lg">
            <div className="mb-1 border-b border-[#6B7280] pb-1 font-sans text-[13px] font-extrabold tracking-wide">CARRIER</div>
            <div>MODEL 24ACC636A003</div>
            <div>REFRIG R-410A · 3.0 TON</div>
            <div>208/230V 1PH 60HZ</div>
          </div>
          {(["left-4 top-4 border-l-[3px] border-t-[3px]", "right-4 top-4 border-r-[3px] border-t-[3px]", "bottom-4 left-4 border-b-[3px] border-l-[3px]", "bottom-4 right-4 border-b-[3px] border-r-[3px]"] as const).map(
            (pos) => (
              <span key={pos} aria-hidden="true" className={`absolute h-5 w-5 border-amber ${pos}`} />
            )
          )}
          <span aria-hidden="true" className="animate-scan absolute left-4 right-4 h-0.5 bg-amber shadow-[0_0_12px_#F59E0B]" />
          <span className="absolute left-2.5 top-2.5 flex items-center gap-1 rounded-md bg-slate-deep/85 px-2 py-1 font-mono text-[9px] text-amber">
            <ScanLine className="h-3 w-3" aria-hidden="true" /> PLATE READ
          </span>
        </div>

        {/* data plate header */}
        <div className="mx-3 mt-3 rounded-xl border border-line bg-steel px-3 py-2.5 font-mono text-[11px] leading-relaxed text-slate-200">
          <span className="font-bold text-amber">CARRIER</span> • Model: 24ACC636A003 • R-410A • 3.0 Ton
        </div>

        {/* safety badge */}
        <div className="mx-3 mt-2 flex items-center gap-2 rounded-xl border border-emerald/40 bg-emerald/10 px-3 py-2 font-mono text-[10.5px] font-bold tracking-wide text-emerald">
          <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
          SAFETY VERIFIED: DISCONNECT PULLED
        </div>

        {/* telemetry pills */}
        <div className="mx-3 mt-2 grid grid-cols-2 gap-2 font-mono text-[11px]">
          <span className="rounded-lg border border-line bg-steel px-2.5 py-1.5 text-slate-200">
            Suction: <b className="text-ink">118 PSI</b>
          </span>
          <span className="rounded-lg border border-line bg-steel px-2.5 py-1.5 text-slate-200">
            Liquid: <b className="text-ink">342 PSI</b>
          </span>
          <span className="col-span-2 flex items-center justify-between rounded-lg border border-gauge/50 bg-gauge/10 px-2.5 py-1.5 text-amber-hi">
            <span>
              Subcooling: <b>4.2°F</b>
            </span>
            <span className="flex items-center gap-1 rounded bg-gauge px-1.5 py-0.5 text-[9.5px] font-bold text-white">
              <TriangleAlert className="h-3 w-3" aria-hidden="true" /> LOW
            </span>
          </span>
        </div>

        {/* AI voice prompt */}
        <div className="mx-3 mt-2 rounded-xl border border-amber/60 bg-steel-2 p-3">
          <div className="flex items-center gap-1.5 font-mono text-[10px] tracking-[0.08em] text-amber">
            <Mic className="h-3 w-3" aria-hidden="true" /> APEXFIELD · VOICE GUIDANCE
          </div>
          <p className="mt-1.5 text-[12.5px] leading-snug text-slate-100">
            “Subcooling is 5.8°F below target (10°F). Check TXV sensing bulb insulation and verify indoor airflow
            across evaporator coil.”
          </p>
        </div>

        {/* waveform */}
        <div className="mx-3 mb-4 mt-3 flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber">
            <Mic className="h-4 w-4 text-slate-deep" aria-hidden="true" />
          </span>
          <div aria-hidden="true" className="flex h-9 flex-1 items-center gap-[3px]">
            {WAVE_HEIGHTS.map((h, i) => (
              <span
                key={i}
                className="animate-wave block flex-1 rounded-sm bg-gradient-to-t from-gauge to-amber"
                style={{ height: `${h}%`, animationDelay: `-${(i * 0.07).toFixed(2)}s` }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
