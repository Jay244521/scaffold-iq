"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  Check,
  CheckCircle2,
  ClipboardCopy,
  Cpu,
  Database,
  Lock,
  MessageSquareText,
  OctagonAlert,
  ShieldAlert,
  ShieldCheck,
  Unlock,
  Wrench,
  X,
} from "lucide-react";
import { DIAGNOSTIC_SEQUENCE, READING_LABELS, SAFETY_STEP } from "@/lib/ai/hvac-tools";
import type { LiveSessionState } from "@/lib/ai/live-session-state";
import type { LiveCaption, LiveSessionInfo } from "@/hooks/useGeminiLiveSession";
import { StatusBadge } from "../TelemetryLog";

const time = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

const card = "rounded-2xl border border-line bg-steel p-5";
const label = "flex items-center gap-2 font-mono text-[11px] tracking-[0.1em] text-muted";

export function EquipmentCard({ equipment }: { equipment: LiveSessionState["equipment"] }) {
  return (
    <div className={`${card} ${equipment ? "border-amber/40" : ""}`}>
      <p className={label}>
        <Cpu className="h-3.5 w-3.5 text-amber" aria-hidden="true" /> ACTIVE EQUIPMENT CONTEXT
      </p>
      {equipment ? (
        <div className="animate-fade-up mt-3">
          <p className="font-mono text-base font-bold text-ink">
            {equipment.manufacturer.toUpperCase()} {equipment.model_number}
          </p>
          <dl className="mt-3 grid grid-cols-2 gap-2 font-mono text-[12px] sm:grid-cols-4">
            {[
              ["TYPE", equipment.equipment_type],
              ["SERIAL", equipment.serial_number ?? "—"],
              ["REFRIG", equipment.refrigerant_type ?? "—"],
              ["SIZE", equipment.tonnage ? `${equipment.tonnage} Ton` : "—"],
            ].map(([k, v]) => (
              <div key={k} className="rounded-lg border border-line bg-slate-deep px-2.5 py-2">
                <dt className="text-[10px] text-muted">{k}</dt>
                <dd className="truncate text-ink" title={v}>
                  {v}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted">Waiting for the data plate. Point the camera at it and tap Scan Data Plate.</p>
      )}
    </div>
  );
}

export function SafetyCard({ safety }: { safety: LiveSessionState["safety"] }) {
  const ok = safety.verified;
  return (
    <div className={`rounded-2xl border-2 p-5 ${ok ? "border-emerald/60 bg-emerald/[0.06]" : "border-danger/60 bg-gradient-to-br from-danger/10 to-amber/5"}`}>
      <div className="flex items-start gap-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${ok ? "bg-emerald/15 text-emerald" : "bg-danger/15 text-danger"}`}>
          {ok ? <ShieldCheck className="h-5 w-5" aria-hidden="true" /> : <ShieldAlert className="h-5 w-5" aria-hidden="true" />}
        </span>
        <div className="min-w-0">
          <p className={`font-mono text-[11px] font-bold tracking-[0.1em] ${ok ? "text-emerald" : "text-danger"}`}>
            {ok ? "SAFETY GATE PASSED" : "HARD SAFETY GATE · HIGH VOLTAGE"}
          </p>
          {ok ? (
            <>
              <p className="mt-1 font-semibold">Disconnect verified · electrical steps unlocked</p>
              <p className="mt-1 font-mono text-xs text-emerald">
                {safety.verification_method === "visual_frame" ? "Seen on camera" : "Verbal confirmation"} · {time(safety.at)}
              </p>
              <p className="mt-1 text-sm text-slate-300">{safety.notes}</p>
            </>
          ) : (
            <p className="mt-1 text-sm text-slate-300">
              Capacitor tests and step 4+ stay locked until ApexField sees the disconnect pulled or you confirm 0V across L1/L2 out loud.
            </p>
          )}
        </div>
        <span className="ml-auto shrink-0 text-muted" aria-hidden="true">
          {ok ? <Unlock className="h-4 w-4 text-emerald" /> : <Lock className="h-4 w-4" />}
        </span>
      </div>
    </div>
  );
}

export function StepTracker({ state }: { state: LiveSessionState }) {
  const current = state.steps[state.currentStep];
  return (
    <div className={card}>
      <p className={label}>DIAGNOSTIC SEQUENCE · STEP {state.currentStep} OF {DIAGNOSTIC_SEQUENCE.length}</p>
      <ol className="mt-3 flex flex-col gap-1.5">
        {DIAGNOSTIC_SEQUENCE.map((title, i) => {
          const n = i + 1;
          const s = state.steps[n]?.status;
          const done =
            s === "passed" ||
            (n === 1 && state.equipment !== null && state.currentStep > 1) ||
            (n === SAFETY_STEP && state.safety.verified);
          const failed = s === "failed";
          const active = n === state.currentStep && !done && !state.completion;
          const locked = n > SAFETY_STEP && !state.safety.verified;
          return (
            <li
              key={n}
              className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-sm ${
                active ? "border-amber/70 bg-amber/10" : failed ? "border-gauge/60 bg-gauge/10" : "border-line bg-slate-deep"
              }`}
            >
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-[11px] font-bold ${
                  done ? "bg-emerald text-slate-deep" : failed ? "bg-gauge text-slate-deep" : active ? "bg-amber text-slate-deep" : "bg-line text-muted"
                }`}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : failed ? <X className="h-3.5 w-3.5" /> : n}
              </span>
              <span className={`flex-1 ${done || active || failed ? "text-ink" : "text-muted"}`}>{title}</span>
              {locked && <Lock className="h-3.5 w-3.5 text-muted" aria-label="Locked until safety gate" />}
              {failed && <span className="font-mono text-[10px] font-bold text-amber-hi">FAILED</span>}
            </li>
          );
        })}
      </ol>
      {current && !state.completion && (
        <div className="animate-fade-up mt-3 rounded-xl border border-amber/40 bg-slate-deep p-3.5">
          <p className="text-[15px] font-semibold leading-snug">{current.instruction}</p>
          <p className="mt-1 font-mono text-xs text-muted">Target: {current.expected_target}</p>
        </div>
      )}
    </div>
  );
}

const BLOCKED_VISIBLE_MS = 12_000;

/** Latest rejected AI action. Auto-dismisses so a resolved block doesn't linger. */
export function BlockedNotice({ blocked }: { blocked: LiveSessionState["blocked"] }) {
  const last = blocked[blocked.length - 1];
  const [dismissed, setDismissed] = useState<string | null>(null);
  useEffect(() => {
    if (!last) return;
    const t = setTimeout(() => setDismissed(last.at), BLOCKED_VISIBLE_MS);
    return () => clearTimeout(t);
  }, [last]);
  if (!last || dismissed === last.at) return null;
  return (
    <div role="alert" className="animate-fade-up flex gap-3 rounded-2xl border border-danger/60 bg-danger/10 p-4">
      <OctagonAlert className="h-5 w-5 shrink-0 text-danger" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="font-mono text-[11px] font-bold tracking-[0.1em] text-danger">AI ACTION BLOCKED · {time(last.at)}</p>
        <p className="mt-1 text-sm text-slate-200">{last.reason}</p>
      </div>
      <button
        type="button"
        onClick={() => setDismissed(last.at)}
        aria-label="Dismiss"
        className="-m-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-muted hover:text-ink"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}

export function ReadingsFeed({ readings }: { readings: LiveSessionState["readings"] }) {
  return (
    <div className={card}>
      <p className={label}>
        <Activity className="h-3.5 w-3.5 text-amber" aria-hidden="true" /> LIVE TELEMETRY · {readings.length} LOGGED
      </p>
      {readings.length === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed border-line-strong p-4 text-sm text-muted">
          Say a reading (&ldquo;suction is 118&rdquo;) or hold a gauge up to the camera. It lands here, judged against OEM spec.
        </p>
      ) : (
        <ol className="mt-3 flex flex-col gap-2">
          {[...readings].reverse().map((r) => (
            <li key={r.id} className="animate-fade-up rounded-xl border border-line bg-slate-deep p-3">
              <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[13px]">
                <span>
                  {READING_LABELS[r.reading_type]}: <b className="text-ink">{r.numeric_value}</b> {r.unit}
                </span>
                <StatusBadge status={r.is_within_spec ? "within" : "out"} />
              </div>
              <p className="mt-1 flex justify-between gap-2 text-xs text-muted">
                <span>{r.target_spec_note}</span>
                <span className="shrink-0 font-mono">{time(r.at)}</span>
              </p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export function TranscriptCard({ captions }: { captions: LiveCaption[] }) {
  if (captions.length === 0) return null;
  return (
    <div className={card}>
      <p className={label}>
        <MessageSquareText className="h-3.5 w-3.5 text-amber" aria-hidden="true" /> TRANSCRIPT
      </p>
      <ol className="mt-3 flex max-h-64 flex-col gap-2 overflow-y-auto text-sm">
        {captions.map((c) => (
          <li key={c.id} className="leading-snug">
            <span className={`mr-2 font-mono text-[10px] font-bold tracking-wider ${c.role === "ai" ? "text-amber" : "text-sky-300"}`}>
              {c.role === "ai" ? "APEX" : "YOU"}
            </span>
            <span className={c.final ? "text-slate-200" : "text-slate-400"}>{c.text}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function PersistenceBadge({ info }: { info: LiveSessionInfo | null }) {
  if (!info) return null;
  return (
    <p className="flex items-center gap-2 font-mono text-[11px] text-muted">
      <Database className={`h-3.5 w-3.5 ${info.persistence ? "text-emerald" : "text-muted"}`} aria-hidden="true" />
      {info.persistence ? `Saving to Supabase · session ${info.sessionId?.slice(0, 8)}` : "Session not saved (Supabase not configured)"}
      <span className="hidden sm:inline">· {info.model}</span>
    </p>
  );
}

export function LiveReport({ state, onNewSession }: { state: LiveSessionState; onNewSession: () => void }) {
  const [copied, setCopied] = useState(false);
  const c = state.completion;
  if (!c) return null;
  const e = state.equipment;

  const text = [
    "APEXFIELD AI · DISPATCH SUMMARY",
    e ? `Equipment: ${e.manufacturer} ${e.model_number}${e.serial_number ? ` S/N ${e.serial_number}` : ""}` : "Equipment: not registered",
    state.safety.verified ? `Safety: disconnect verified (${state.safety.verification_method}) ${time(state.safety.at)}` : "Safety: disconnect not verified",
    "",
    "Readings:",
    ...state.readings.map((r) => `- ${READING_LABELS[r.reading_type]}: ${r.numeric_value} ${r.unit} [${r.is_within_spec ? "within" : "OUT OF"} spec] ${r.target_spec_note}`),
    "",
    `Root cause: ${c.confirmed_root_cause}`,
    `Parts: ${c.parts_replaced.length ? c.parts_replaced.join(", ") : "none"}`,
    "",
    c.dispatch_summary_report,
  ].join("\n");

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked */
    }
  };

  return (
    <div className="animate-fade-up flex flex-col gap-4">
      <div className="rounded-2xl border-2 border-emerald/60 bg-gradient-to-br from-emerald/10 to-transparent p-5 sm:p-6">
        <p className="flex items-center gap-2 font-mono text-[11px] font-bold tracking-[0.1em] text-emerald">
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> SERVICE CALL COMPLETE · ROOT CAUSE CONFIRMED
        </p>
        <h2 className="mt-2 text-2xl font-extrabold tracking-tight">{c.confirmed_root_cause}</h2>
      </div>
      <div className={card}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className={label}>DISPATCH SUMMARY</p>
          <button
            type="button"
            onClick={copy}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-line-strong px-3 text-sm font-semibold transition-colors hover:border-amber hover:text-amber"
          >
            {copied ? <Check className="h-4 w-4 text-emerald" /> : <ClipboardCopy className="h-4 w-4" />}
            {copied ? "Copied" : "Copy report"}
          </button>
        </div>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-200">{c.dispatch_summary_report}</p>
        {c.parts_replaced.length > 0 && (
          <ul className="mt-4 flex flex-col gap-1.5 text-sm">
            {c.parts_replaced.map((p) => (
              <li key={p} className="flex items-center gap-2">
                <Wrench className="h-4 w-4 text-amber" aria-hidden="true" /> {p}
              </li>
            ))}
          </ul>
        )}
        <button
          type="button"
          onClick={onNewSession}
          className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-amber px-6 font-bold text-slate-deep transition-colors hover:bg-amber-hi"
        >
          Start a new call
        </button>
      </div>
    </div>
  );
}
