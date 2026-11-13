import { Loader2, ScanLine } from "lucide-react";
import type { Scenario } from "@/lib/demo-scenarios";

export function DataPlateScanner({
  scenario,
  scanning,
  onScan,
}: {
  scenario: Scenario;
  scanning: boolean;
  onScan: () => void;
}) {
  const e = scenario.equipment;
  return (
    <section aria-labelledby="scan-heading" className="animate-fade-up grid grid-cols-1 items-center gap-10 lg:grid-cols-2">
      <div className="flex flex-col gap-4">
        <p className="font-mono text-[13px] tracking-[0.1em] text-amber">STAGE 1 · OEM DATA-PLATE SCAN</p>
        <h1 id="scan-heading" className="text-3xl font-extrabold tracking-tight sm:text-[2.4rem] sm:leading-tight">
          Point the camera at the plate.
        </h1>
        <p className="text-lg leading-relaxed text-muted">
          You&apos;re on site at the {e.manufacturer} {scenario.name.toLowerCase()}. One scan pulls the model, serial and
          refrigerant, and loads the exact OEM charging and wiring specs into the session.
        </p>
        <div className="rounded-xl border border-gauge/40 bg-gauge/10 p-4">
          <p className="font-mono text-[10.5px] font-bold tracking-[0.1em] text-gauge">REPORTED SYMPTOM</p>
          <p className="mt-1 text-[15px] text-slate-200">“{scenario.symptom}”</p>
        </div>
        <button
          type="button"
          onClick={onScan}
          disabled={scanning}
          className="mt-2 inline-flex min-h-13 w-full items-center justify-center gap-2 rounded-xl bg-amber px-7 py-3.5 text-base font-bold text-slate-deep shadow-[0_8px_30px_-8px_rgba(245,158,11,0.6)] transition-all hover:bg-amber-hi disabled:opacity-80 sm:w-fit"
        >
          {scanning ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> Reading plate…
            </>
          ) : (
            <>
              <ScanLine className="h-5 w-5" aria-hidden="true" /> Scan Data Plate
            </>
          )}
        </button>
        <p className="sr-only" aria-live="polite">
          {scanning ? "Scanning data plate" : ""}
        </p>
      </div>

      {/* Viewfinder */}
      <div className="flex justify-center">
        <div className="relative w-full max-w-[400px] overflow-hidden rounded-[40px] border-[10px] border-line bg-[#05070D] shadow-[0_40px_100px_-30px_rgba(0,0,0,0.9)]">
          <div className="flex items-center justify-between px-5 py-3 font-mono text-[10px] text-muted">
            <span>CAMERA · REAR</span>
            <span className={scanning ? "text-amber" : "text-emerald"}>{scanning ? "● SCANNING" : "● READY"}</span>
          </div>
          <div className="relative mx-3 mb-3 flex h-[340px] items-center justify-center overflow-hidden rounded-3xl bg-[#1A2130]">
            <div
              aria-hidden="true"
              className="absolute inset-0 [background:repeating-linear-gradient(90deg,#1A2130_0_14px,#212A3C_14px_16px)]"
            />
            {/* Metal plate */}
            <div
              role="img"
              aria-label={`${e.manufacturer} data plate, model ${e.model}`}
              className="relative w-[78%] -rotate-2 rounded-md border border-[#9CA3AF] bg-gradient-to-br from-[#D5D9DE] via-[#C2C7CE] to-[#AEB4BC] px-4 py-3.5 font-mono text-[10.5px] leading-[1.6] text-[#1F2937] shadow-[0_10px_30px_rgba(0,0,0,0.6)]"
            >
              <span aria-hidden="true" className="absolute left-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[#6B7280]" />
              <span aria-hidden="true" className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[#6B7280]" />
              <span aria-hidden="true" className="absolute bottom-1.5 left-1.5 h-1.5 w-1.5 rounded-full bg-[#6B7280]" />
              <span aria-hidden="true" className="absolute bottom-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-[#6B7280]" />
              <p className="mb-1.5 border-b border-[#6B7280] pb-1.5 font-sans text-[15px] font-extrabold tracking-[0.06em]">
                {e.manufacturer.toUpperCase()}
              </p>
              {e.plate.map(([k, v]) => (
                <p key={k} className="flex gap-2">
                  <span className="w-[68px] shrink-0 text-[#4B5563]">{k}</span>
                  <span className="font-bold">{v}</span>
                </p>
              ))}
            </div>
            {/* Reticle */}
            {(
              [
                "left-6 top-6 border-l-[3px] border-t-[3px]",
                "right-6 top-6 border-r-[3px] border-t-[3px]",
                "bottom-6 left-6 border-b-[3px] border-l-[3px]",
                "bottom-6 right-6 border-b-[3px] border-r-[3px]",
              ] as const
            ).map((pos) => (
              <span
                key={pos}
                aria-hidden="true"
                className={`absolute h-8 w-8 transition-colors ${scanning ? "border-amber" : "border-amber/70"} ${pos}`}
              />
            ))}
            <span
              aria-hidden="true"
              className={`absolute left-6 right-6 h-0.5 bg-amber shadow-[0_0_16px_#F59E0B] ${scanning ? "animate-scan-fast" : "animate-scan"}`}
            />
            {scanning && (
              <div className="absolute inset-x-6 bottom-10 h-1.5 overflow-hidden rounded-full bg-slate-deep/70">
                <div className="animate-progress h-full rounded-full bg-gradient-to-r from-amber to-gauge" />
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
