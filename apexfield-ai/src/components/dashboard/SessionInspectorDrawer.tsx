"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock,
  Headphones,
  Lock,
  MapPin,
  Pause,
  Send,
  ShieldAlert,
  ShieldCheck,
  Truck,
  UserPlus,
  X,
} from "lucide-react";
import { DIAGNOSTIC_SEQUENCE, SAFETY_STEP } from "@/lib/diagnostic-sequence";
import type { DiagnosticStep, Technician, TranscriptLine } from "@/lib/mock-fleet-data";
import { EquipmentPill, ExperienceBadge, READING_TONE, StatusBadge, formatElapsed } from "./fleet-ui";
import { PovFrame } from "./PovFrame";

type Props = {
  tech: Technician;
  onClose: () => void;
  onWhisper: (id: string, text: string) => void;
  onClear: (id: string) => void;
  onDispatch: (id: string) => void;
};

const section = "rounded-2xl border border-line bg-slate-deep/60 p-4";
const sectionTitle = "font-mono text-[11px] font-bold tracking-[0.12em] text-muted";

export function SessionInspectorDrawer({ tech, onClose, onWhisper, onClear, onDispatch }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Focus management, Escape to close, simple focus trap, body scroll lock.
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key !== "Tab" || !panelRef.current) return;
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), textarea:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  const titleId = `inspector-${tech.id}`;

  return (
    <div className="fixed inset-0 z-50" role="presentation">
      <div className="animate-fade-in absolute inset-0 bg-black/65 backdrop-blur-[2px]" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="animate-slide-in absolute inset-y-0 right-0 flex w-full max-w-2xl flex-col border-l border-line bg-steel shadow-2xl"
      >
        <header className="flex items-start gap-3 border-b border-line px-4 py-4 sm:px-6">
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[11px] tracking-[0.12em] text-amber">LIVE SESSION INSPECTOR</p>
            <h2 id={titleId} className="mt-1 truncate text-xl font-extrabold">
              {tech.name}
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <ExperienceBadge tech={tech} />
              <span className="inline-flex items-center gap-1 font-mono text-xs text-amber">
                <Truck className="h-3.5 w-3.5" aria-hidden="true" />
                {tech.truck}
              </span>
              <span className="inline-flex items-center gap-1 font-mono text-xs text-muted">
                <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                {formatElapsed(tech.elapsedSec)} on site
              </span>
            </div>
            <p className="mt-1.5 flex items-center gap-1.5 text-sm text-slate-400">
              <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {tech.customer} · {tech.city} · {tech.jobType}
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close session inspector"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-line-strong text-slate-300 hover:border-amber hover:text-amber"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={tech.status} />
              {tech.backupDispatched && (
                <span className="inline-flex items-center gap-1 rounded-md bg-amber/10 px-2 py-1 font-mono text-[10px] font-bold text-amber ring-1 ring-amber/40">
                  <UserPlus className="h-3 w-3" aria-hidden="true" /> BACKUP EN ROUTE
                </span>
              )}
            </div>
            <EquipmentPill equipment={tech.equipment} />

            <AttentionBanner tech={tech} onClear={onClear} />

            {/* 1. POV feed + transcript */}
            <section className={section} aria-labelledby={`${titleId}-feed`}>
              <h3 id={`${titleId}-feed`} className={sectionTitle}>
                {tech.live ? "1 · LIVE SESSION · SAFETY & EVENT LOG" : "1 · POV CAMERA FEED & VOICE TRANSCRIPT"}
              </h3>
              <div className="mt-3">{tech.live ? <LiveFrameNote tech={tech} /> : <PovFrame tech={tech} />}</div>
              <Transcript lines={tech.transcript} label={tech.live ? "SESSION EVENT LOG" : "LIVE VOICE TRANSCRIPT"} />
            </section>

            {/* 2. Timeline */}
            <section className={section} aria-labelledby={`${titleId}-timeline`}>
              <h3 id={`${titleId}-timeline`} className={sectionTitle}>
                2 · DIAGNOSTIC TIMELINE
              </h3>
              <Timeline tech={tech} />
            </section>

            {/* 3. Telemetry table */}
            <section className={section} aria-labelledby={`${titleId}-telemetry`}>
              <h3 id={`${titleId}-telemetry`} className={sectionTitle}>
                3 · LOGGED TELEMETRY · {tech.readings.length} READINGS
              </h3>
              <TelemetryTable tech={tech} />
            </section>

            {/* 4. Intervention */}
            <section className={`${section} border-amber/30`} aria-labelledby={`${titleId}-controls`}>
              <h3 id={`${titleId}-controls`} className={`${sectionTitle} text-amber`}>
                4 · SERVICE MANAGER INTERVENTION
              </h3>
              <Interventions tech={tech} onWhisper={onWhisper} onClear={onClear} onDispatch={onDispatch} />
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ pieces ------------------------------ */

function AttentionBanner({ tech, onClear }: { tech: Technician; onClear: (id: string) => void }) {
  if (tech.status !== "escalated" && tech.status !== "safety_hold") return null;
  const esc = tech.status === "escalated";
  return (
    <div role="alert" className={`flex flex-col gap-3 rounded-2xl border-2 p-4 ${esc ? "border-danger/70 bg-danger/10" : "border-amber/60 bg-amber/10"}`}>
      <div className="flex gap-3">
        {esc ? <AlertTriangle className="h-5 w-5 shrink-0 text-danger" aria-hidden="true" /> : <ShieldAlert className="h-5 w-5 shrink-0 text-amber" aria-hidden="true" />}
        <div>
          <p className={`font-mono text-[11px] font-bold tracking-[0.1em] ${esc ? "text-danger" : "text-amber"}`}>
            {esc ? "AI ESCALATION · NEEDS SENIOR REVIEW" : "SAFETY GATE HOLD · ELECTRICAL LOCKED"}
          </p>
          <p className="mt-1 text-sm text-slate-100">{tech.statusReason}</p>
        </div>
      </div>
      {esc && tech.live && (
        <button
          type="button"
          onClick={() => onClear(tech.id)}
          className="inline-flex min-h-11 items-center justify-center gap-2 self-start rounded-xl bg-emerald px-4 text-sm font-bold text-slate-deep hover:brightness-110"
        >
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Mark reviewed · tech continues
        </button>
      )}
      {esc && tech.live && (
        <p className="text-xs text-muted">Send guidance below first if they need it. Marking reviewed tells their AI coach to let them continue.</p>
      )}
      {esc && !tech.live && (
        <button
          type="button"
          onClick={() => onClear(tech.id)}
          className="inline-flex min-h-11 items-center justify-center gap-2 self-start rounded-xl bg-emerald px-4 text-sm font-bold text-slate-deep hover:brightness-110"
        >
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Approve Escalation
        </button>
      )}
    </div>
  );
}

const ROLE_STYLE: Record<TranscriptLine["role"], { label: string; cls: string; text: string }> = {
  ai: { label: "AI COACH", cls: "text-amber", text: "text-slate-200" },
  tech: { label: "TECH", cls: "text-sky-300", text: "text-slate-200" },
  manager: { label: "[MANAGER OVERRIDE]", cls: "text-gauge", text: "text-ink font-medium" },
  system: { label: "SYSTEM", cls: "text-muted", text: "text-muted italic" },
};

function Transcript({ lines, label }: { lines: TranscriptLine[]; label: string }) {
  const listRef = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines.length]);
  return (
    <div className="mt-3">
      <p className="flex items-center gap-2 font-mono text-[10px] tracking-[0.1em] text-muted">
        <Headphones className="h-3.5 w-3.5 text-amber" aria-hidden="true" /> {label}
      </p>
      <ol ref={listRef} aria-live="polite" className="mt-2 flex max-h-72 flex-col gap-2 overflow-y-auto rounded-xl border border-line bg-[#080b13] p-3">
        {lines.map((l) => {
          const s = ROLE_STYLE[l.role];
          return (
            <li
              key={l.id}
              className={`animate-fade-up text-sm leading-snug ${l.role === "manager" ? "rounded-lg border border-gauge/50 bg-gauge/10 p-2" : ""}`}
            >
              <span className="mr-2 font-mono text-[10px] text-muted">{formatElapsed(l.atSec)}</span>
              <span className={`mr-1.5 font-mono text-[10px] font-bold tracking-wider ${s.cls}`}>{s.label}</span>
              <span className={s.text}>{l.text}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function stepVisual(step: DiagnosticStep) {
  switch (step.status) {
    case "passed":
      return { dot: "bg-emerald text-slate-deep", icon: <Check className="h-3.5 w-3.5" />, label: "PASSED", tone: "text-emerald" };
    case "failed":
      return { dot: "bg-danger text-white", icon: <AlertTriangle className="h-3.5 w-3.5" />, label: "OUT OF SPEC", tone: "text-danger" };
    case "hold":
      return { dot: "bg-amber text-slate-deep", icon: <Pause className="h-3.5 w-3.5" />, label: "ON HOLD", tone: "text-amber" };
    case "active":
      return { dot: "bg-amber/20 text-amber ring-2 ring-amber", icon: <span className="h-2 w-2 animate-pulse rounded-full bg-amber" />, label: "IN PROGRESS", tone: "text-amber" };
    default:
      return { dot: "bg-line text-muted", icon: null, label: "UPCOMING", tone: "text-muted" };
  }
}

function Timeline({ tech }: { tech: Technician }) {
  return (
    <ol className="mt-3 flex flex-col">
      {tech.steps.map((step, i) => {
        const v = stepVisual(step);
        const locked = step.n > SAFETY_STEP && !tech.safetyVerified && step.status === "upcoming";
        return (
          <li key={step.n} className="relative flex gap-3 pb-4 last:pb-0">
            {i < tech.steps.length - 1 && <span className="absolute left-[13px] top-7 h-[calc(100%-1.75rem)] w-px bg-line-strong" aria-hidden="true" />}
            <span className={`relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-mono text-xs font-bold ${v.dot}`}>
              {v.icon ?? step.n}
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="flex flex-wrap items-center gap-x-2 text-sm font-semibold text-ink">
                Step {step.n} · {DIAGNOSTIC_SEQUENCE[step.n - 1]}
                <span className={`font-mono text-[10px] font-bold tracking-wider ${v.tone}`}>{v.label}</span>
                {locked && <Lock className="h-3.5 w-3.5 text-muted" aria-label="Locked until safety gate" />}
              </p>
              {step.finding && <p className="mt-0.5 font-mono text-xs text-slate-400">{step.finding}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function TelemetryTable({ tech }: { tech: Technician }) {
  if (!tech.readings.length) return <p className="mt-3 text-sm text-muted">No readings logged yet.</p>;
  return (
    <div className="mt-3 overflow-x-auto rounded-xl border border-line">
      <table className="w-full min-w-[480px] text-left text-sm">
        <thead className="bg-steel-2 font-mono text-[10px] tracking-[0.1em] text-muted">
          <tr>
            <th scope="col" className="px-3 py-2 font-semibold">READING TYPE</th>
            <th scope="col" className="px-3 py-2 font-semibold">VALUE</th>
            <th scope="col" className="px-3 py-2 font-semibold">OEM TARGET SPEC</th>
            <th scope="col" className="px-3 py-2 font-semibold">STATUS</th>
            <th scope="col" className="px-3 py-2 text-right font-semibold">T+</th>
          </tr>
        </thead>
        <tbody>
          {tech.readings.map((r) => (
            <tr key={r.id} className="border-t border-line">
              <td className="px-3 py-2 text-slate-200">{r.label}</td>
              <td className="px-3 py-2 font-mono font-semibold text-ink">
                {r.value}
                {r.unit.startsWith("°") ? "" : " "}
                {r.unit}
              </td>
              <td className="px-3 py-2 font-mono text-xs text-slate-400">{r.spec}</td>
              <td className="px-3 py-2">
                <span className={`rounded border px-1.5 py-0.5 font-mono text-[10px] font-bold ${READING_TONE[r.status]}`}>
                  {r.status === "ok" ? "IN SPEC" : r.status.toUpperCase()}
                </span>
              </td>
              <td className="px-3 py-2 text-right font-mono text-xs text-muted">{formatElapsed(r.atSec)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Interventions({ tech, onWhisper, onClear, onDispatch }: Omit<Props, "onClose">) {
  const [text, setText] = useState("");
  const [confirmHold, setConfirmHold] = useState(false);
  const ended = tech.status === "completed" || tech.status === "ended";
  const canClear = tech.status === "escalated" || tech.status === "safety_hold";

  // Reset the hold confirmation if the tech or status changes underneath us.
  useEffect(() => setConfirmHold(false), [tech.id, tech.status]);

  const send = () => {
    if (!text.trim() || ended) return;
    onWhisper(tech.id, text);
    setText("");
  };

  return (
    <div className="mt-3 flex flex-col gap-4">
      <div>
        <label htmlFor={`whisper-${tech.id}`} className="flex items-center gap-2 text-sm font-semibold text-ink">
          <Headphones className="h-4 w-4 text-amber" aria-hidden="true" /> Push Whisper Guidance to Tech Headset
        </label>
        <textarea
          id={`whisper-${tech.id}`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              send();
            }
          }}
          disabled={ended}
          rows={3}
          maxLength={500}
          placeholder={ended ? "Session ended" : "e.g. Check the 24V common wire at the air handler splice before condemning the board"}
          className="mt-2 w-full resize-y rounded-xl border border-line-strong bg-[#080b13] px-3 py-2.5 text-sm text-ink placeholder:text-muted focus:border-amber focus:outline-none disabled:opacity-50"
        />
        <div className="mt-2 flex items-center justify-between gap-3">
          <span className="font-mono text-[10px] text-muted">{text.length}/500 · ⌘/Ctrl+Enter to send</span>
          <button
            type="button"
            onClick={send}
            disabled={!text.trim() || ended}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-amber px-4 text-sm font-bold text-slate-deep hover:bg-amber-hi disabled:cursor-not-allowed disabled:bg-line-strong disabled:text-muted"
          >
            <Send className="h-4 w-4" aria-hidden="true" /> Send to AI Coach
          </button>
        </div>
      </div>

      {tech.live ? (
        <p className="rounded-xl border border-line bg-slate-deep px-3 py-2.5 text-xs text-muted">
          Your note is spoken to the technician by their AI coach. It can&apos;t override the safety gate: the disconnect is only cleared when the coach sees it pulled or the tech confirms 0V.
        </p>
      ) : (
      <div className="grid gap-2 sm:grid-cols-2">
        {tech.status === "safety_hold" && confirmHold ? (
          <div className="flex flex-col gap-2 rounded-xl border border-amber/60 bg-amber/10 p-3 sm:col-span-2">
            <p className="text-sm text-amber-hi">
              Only clear this hold if {tech.name.split(" ")[0]} has confirmed by radio or phone that the disconnect is pulled and their meter reads 0V L1–L2.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onClear(tech.id)}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald px-4 text-sm font-bold text-slate-deep hover:brightness-110"
              >
                <Check className="h-4 w-4" aria-hidden="true" /> Tech confirmed 0V, clear hold
              </button>
              <button
                type="button"
                onClick={() => setConfirmHold(false)}
                className="inline-flex min-h-11 items-center rounded-xl border border-line-strong px-4 text-sm font-semibold hover:border-amber hover:text-amber"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => (tech.status === "safety_hold" ? setConfirmHold(true) : onClear(tech.id))}
            disabled={!canClear}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-emerald/60 bg-emerald/10 px-4 text-sm font-bold text-emerald hover:bg-emerald/20 disabled:cursor-not-allowed disabled:border-line disabled:bg-transparent disabled:text-muted"
          >
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            {tech.status === "safety_hold" ? "Clear Safety Hold" : tech.status === "escalated" ? "Approve Escalation" : "No Hold to Clear"}
          </button>
        )}
        <button
          type="button"
          onClick={() => onDispatch(tech.id)}
          disabled={tech.backupDispatched || ended}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-line-strong px-4 text-sm font-bold text-ink hover:border-amber hover:text-amber disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-line-strong disabled:hover:text-ink"
        >
          <UserPlus className="h-4 w-4" aria-hidden="true" />
          {tech.backupDispatched ? "Senior Backup En Route" : "Dispatch Senior Tech Backup"}
        </button>
      </div>
      )}
    </div>
  );
}

/** Live sessions don't store camera frames (privacy); show safety + equipment status instead. */
function LiveFrameNote({ tech }: { tech: Technician }) {
  const ok = tech.safetyVerified;
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line bg-[#05070d] p-4">
      <span
        className={`inline-flex items-center gap-1.5 self-start rounded-md px-2 py-1 font-mono text-[10px] font-bold tracking-wider ${
          ok ? "bg-emerald/90 text-slate-deep" : "bg-danger/90 text-white"
        }`}
      >
        {ok ? <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" /> : <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />}
        {ok ? "SAFETY DISCONNECT VERIFIED" : "DISCONNECT NOT VERIFIED · ELECTRICAL LOCKED"}
      </span>
      <p className="text-sm text-slate-300">
        Camera frames stay between the technician&apos;s phone and the AI coach; they aren&apos;t stored. Steps, readings and your notes appear below as they happen.
      </p>
      {tech.live && <p className="font-mono text-[10px] text-muted">SESSION {tech.live.sessionId.slice(0, 8)} · STARTED {new Date(tech.live.startedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</p>}
    </div>
  );
}
