import { Lock, ShieldAlert, ShieldCheck, Unlock } from "lucide-react";
import { SAFETY_GATE_TEXT } from "@/lib/demo-scenarios";

export function SafetyGateCard({
  verified,
  verifiedAt,
  onToggle,
  onContinue,
}: {
  verified: boolean;
  verifiedAt: string | null;
  onToggle: () => void;
  onContinue: () => void;
}) {
  return (
    <div
      className={`rounded-2xl border-2 p-5 transition-colors sm:p-6 ${
        verified ? "border-emerald/70 bg-emerald/[0.06]" : "border-danger/70 bg-gradient-to-br from-danger/10 to-amber/5"
      }`}
    >
      <div className="flex items-center gap-3">
        <span
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
            verified ? "bg-emerald/15 text-emerald" : "bg-danger/15 text-danger"
          }`}
        >
          {verified ? <ShieldCheck className="h-6 w-6" aria-hidden="true" /> : <ShieldAlert className="h-6 w-6" aria-hidden="true" />}
        </span>
        <div>
          <p className={`font-mono text-[11px] font-bold tracking-[0.1em] ${verified ? "text-emerald" : "text-danger"}`}>
            {verified ? "SAFETY GATE PASSED" : "HARD SAFETY GATE · HIGH VOLTAGE"}
          </p>
          <p className="text-base font-bold">Mandatory before electrical inspection</p>
        </div>
      </div>

      <p className="mt-4 rounded-xl border border-amber/40 bg-slate-deep/70 p-4 text-[15px] font-semibold leading-relaxed text-amber-hi">
        {SAFETY_GATE_TEXT}
      </p>

      <label className="mt-5 flex min-h-14 cursor-pointer items-center justify-between gap-4 rounded-xl border border-line bg-slate-deep px-4 py-3">
        <span className="text-[15px] font-semibold">Disconnect Pulled &amp; Verified (0V)</span>
        <span className="relative inline-flex shrink-0 items-center">
          <input type="checkbox" role="switch" checked={verified} onChange={onToggle} className="peer sr-only" />
          <span className="h-8 w-14 rounded-full bg-line-strong transition-colors peer-checked:bg-emerald peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-amber" />
          <span className="absolute left-1 top-1 h-6 w-6 rounded-full bg-ink shadow transition-transform peer-checked:translate-x-6" />
        </span>
      </label>

      {verified && verifiedAt && (
        <p className="mt-3 font-mono text-xs text-emerald">0V AC verified L1/L2 · {verifiedAt}</p>
      )}

      <button
        type="button"
        onClick={onContinue}
        disabled={!verified}
        className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald px-6 font-bold text-slate-deep transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:bg-line-strong disabled:text-muted"
      >
        {verified ? <Unlock className="h-4 w-4" aria-hidden="true" /> : <Lock className="h-4 w-4" aria-hidden="true" />}
        {verified ? "Unlock Electrical Inspection" : "Locked — verify 0V to continue"}
      </button>
    </div>
  );
}
