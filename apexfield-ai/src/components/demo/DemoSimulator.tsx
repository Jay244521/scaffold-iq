"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowRight, FileText } from "lucide-react";
import {
  buildReading,
  collectValues,
  getScenario,
  stepStatus,
  type LogEntry,
  type ReadingStep,
  type ReadingValues,
  type ScenarioId,
} from "@/lib/demo-scenarios";
import { DemoTopBar } from "./DemoTopBar";
import { ScenarioSelector } from "./ScenarioSelector";
import { DataPlateScanner } from "./DataPlateScanner";
import { EquipmentDrawer } from "./EquipmentDrawer";
import { StepProgress, type StepState } from "./StepProgress";
import { VoiceCoachPanel, type CoachTone } from "./VoiceCoachPanel";
import { SafetyGateCard } from "./SafetyGateCard";
import { TelemetryControls } from "./TelemetryControls";
import { StatusBadge, TelemetryLog } from "./TelemetryLog";
import { DiagnosticReport } from "./DiagnosticReport";
import { useSpeech } from "./useSpeech";

type Phase = "select" | "scan" | "diagnose" | "complete";
type Pending = { status: "within" | "out"; reasoning: string; entry: Extract<LogEntry, { type: "reading" }> } | null;

const SCAN_MS = 1200;

function defaultsFor(step: ReadingStep): ReadingValues {
  return Object.fromEntries(step.metrics.map((m) => [m.id, m.simulated]));
}

function clock(): string {
  return new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function DemoSimulator({ modeSwitch }: { modeSwitch?: ReactNode } = {}) {
  const [phase, setPhase] = useState<Phase>("select");
  const [scenarioId, setScenarioId] = useState<ScenarioId | null>(null);
  const [scanning, setScanning] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [values, setValues] = useState<ReadingValues>({});
  const [gateVerified, setGateVerified] = useState(false);
  const [gateTime, setGateTime] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [pending, setPending] = useState<Pending>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [generatedAt, setGeneratedAt] = useState("");
  const [pulse, setPulse] = useState(false);

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const speech = useSpeech();
  const { speak, stop } = speech;

  const scenario = scenarioId ? getScenario(scenarioId) : null;
  const step = scenario ? scenario.steps[stepIndex] : null;

  const later = useCallback((fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, ms));
  }, []);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [phase]);

  /* ---------- coach message ---------- */
  const coach = useMemo((): { message: string; tone: CoachTone } => {
    if (!scenario || !step) return { message: "", tone: "instruction" };
    if (phase === "complete") {
      const rc = confirmed ? scenario.rootCause : scenario.unconfirmed;
      return {
        message: confirmed
          ? `Diagnostic complete. Root cause confirmed: ${rc.title}. Dispatch report is ready.`
          : `Diagnostic complete. ${rc.title}. Dispatch report is ready.`,
        tone: confirmed ? "within" : "out",
      };
    }
    if (pending) return { message: pending.reasoning, tone: pending.status };
    if (step.kind === "safety") {
      return gateVerified
        ? { message: "Zero volts confirmed on L1 and L2. Gate released. Electrical inspection is unlocked.", tone: "within" }
        : { message: step.instruction, tone: "safety" };
    }
    return { message: step.instruction, tone: "instruction" };
  }, [scenario, step, phase, pending, gateVerified, confirmed]);

  useEffect(() => {
    if ((phase !== "diagnose" && phase !== "complete") || !coach.message) return;
    speak(coach.message);
    setPulse(true);
    const t = setTimeout(() => setPulse(false), 2600);
    return () => clearTimeout(t);
  }, [coach.message, phase, speak]);

  /* ---------- handlers ---------- */
  const reset = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    stop();
    setPhase("select");
    setScenarioId(null);
    setScanning(false);
    setStepIndex(0);
    setValues({});
    setGateVerified(false);
    setGateTime(null);
    setLogs([]);
    setPending(null);
    setConfirmed(false);
    setGeneratedAt("");
  }, [stop]);

  const selectScenario = (id: ScenarioId) => {
    setScenarioId(id);
    setPhase("scan");
  };

  const scan = () => {
    if (!scenario || scanning) return;
    setScanning(true);
    later(() => {
      setScanning(false);
      setStepIndex(0);
      setValues(defaultsFor(scenario.steps[0]));
      setPhase("diagnose");
    }, SCAN_MS);
  };

  const logReading = (source: "voice" | "manual") => {
    if (!step || step.kind !== "reading" || pending) return;
    const vals = source === "voice" ? defaultsFor(step) : { ...defaultsFor(step), ...values };
    if (source === "voice") setValues(vals);
    const readings = buildReading(step, vals);
    const status = stepStatus(step, vals);
    const reasoning = status === "within" ? step.inSpec(vals) : step.outOfSpec(vals);
    const entry: Extract<LogEntry, { type: "reading" }> = {
      type: "reading",
      stepIndex,
      stepTitle: step.title,
      time: clock(),
      source,
      spoken: source === "voice" ? step.voiceChip : undefined,
      readings,
      status,
      reasoning,
    };
    setLogs((l) => [...l, entry]);
    setPending({ status, reasoning, entry });
  };

  const toggleGate = () => {
    const next = !gateVerified;
    setGateVerified(next);
    setGateTime(next ? clock() : null);
  };

  const passGate = () => {
    if (!step || step.kind !== "safety" || !gateVerified || !scenario) return;
    setLogs((l) => [
      ...l,
      { type: "safety", stepIndex, stepTitle: step.title, time: gateTime ?? clock(), status: "verified", reasoning: "Gate released." },
    ]);
    const next = scenario.steps[stepIndex + 1];
    setStepIndex(stepIndex + 1);
    if (next.kind === "reading") setValues(defaultsFor(next));
  };

  const continueStep = () => {
    if (!scenario) return;
    setPending(null);
    if (stepIndex >= scenario.steps.length - 1) {
      setConfirmed(scenario.confirm(collectValues(logs)));
      setGeneratedAt(new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "medium" }));
      setPhase("complete");
      return;
    }
    const next = scenario.steps[stepIndex + 1];
    setStepIndex(stepIndex + 1);
    if (next.kind === "reading") setValues(defaultsFor(next));
  };

  /* ---------- step states ---------- */
  const stepStates: StepState[] = scenario
    ? scenario.steps.map((_, i) => {
        const entry = logs.find((l) => l.stepIndex === i);
        if (entry) return entry.type === "safety" ? "done-safety" : entry.status === "within" ? "done-within" : "done-out";
        if (i === stepIndex && phase === "diagnose") return "active";
        return "upcoming";
      })
    : [];

  return (
    <div className="min-h-screen">
      <DemoTopBar onReset={reset} canReset={phase !== "select"} />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-8 sm:py-12">
        {modeSwitch}
        {phase === "select" && <ScenarioSelector onSelect={selectScenario} />}

        {phase === "scan" && scenario && <DataPlateScanner scenario={scenario} scanning={scanning} onScan={scan} />}

        {phase === "diagnose" && scenario && step && (
          <div className="animate-fade-up flex flex-col gap-5">
            <div className="flex flex-col gap-1">
              <p className="font-mono text-[13px] tracking-[0.1em] text-amber">
                STAGE 2 · LIVE DIAGNOSTIC · SCENARIO {scenario.id}
              </p>
              <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
                {scenario.name}: {scenario.category}
              </h1>
            </div>
            <EquipmentDrawer scenario={scenario} />
            <StepProgress steps={scenario.steps} states={stepStates} />

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <VoiceCoachPanel
                stepLabel={`STEP ${stepIndex + 1} OF 4`}
                stepTitle={step.title}
                message={coach.message}
                tone={coach.tone}
                vision={step.vision}
                visionVerified={step.kind === "safety" ? gateVerified : pending?.status === "within"}
                speech={{
                  supported: speech.supported,
                  enabled: speech.enabled,
                  speaking: speech.speaking,
                  onToggle: () => speech.toggle(coach.message),
                }}
                active={pulse}
              />

              <div className="flex flex-col gap-5">
                {step.kind === "safety" ? (
                  <SafetyGateCard verified={gateVerified} verifiedAt={gateTime} onToggle={toggleGate} onContinue={passGate} />
                ) : pending ? (
                  <ResultCard
                    pending={pending}
                    isLast={stepIndex === scenario.steps.length - 1}
                    nextStep={stepIndex + 2}
                    onContinue={continueStep}
                  />
                ) : (
                  <TelemetryControls
                    step={step}
                    values={values}
                    onChange={(id, v) => setValues((s) => ({ ...s, [id]: v }))}
                    onVoice={() => logReading("voice")}
                    onLog={() => logReading("manual")}
                    locked={false}
                  />
                )}
                <TelemetryLog logs={logs} />
              </div>
            </div>
          </div>
        )}

        {phase === "complete" && scenario && (
          <DiagnosticReport
            scenario={scenario}
            logs={logs}
            safetyTime={gateTime}
            confirmed={confirmed}
            generatedAt={generatedAt}
            onRestart={reset}
          />
        )}
      </main>
    </div>
  );
}

function ResultCard({
  pending,
  isLast,
  nextStep,
  onContinue,
}: {
  pending: NonNullable<Pending>;
  isLast: boolean;
  nextStep: number;
  onContinue: () => void;
}) {
  const within = pending.status === "within";
  return (
    <div className={`animate-fade-up rounded-2xl border-2 bg-steel p-5 sm:p-6 ${within ? "border-emerald/60" : "border-gauge/70"}`}>
      <p className={`font-mono text-[12px] font-bold tracking-[0.1em] ${within ? "text-emerald" : "text-gauge"}`}>
        AI EVALUATION · {within ? "WITHIN SPEC" : "OUT OF SPEC"}
      </p>
      <ul className="mt-4 flex flex-col gap-2">
        {pending.entry.readings.map((r) => (
          <li key={r.metricId} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-slate-deep px-3 py-2.5 font-mono text-[13px]">
            <span>
              {r.label}: <b>{r.display} {r.unit}</b> <span className="text-muted">/ {r.specLabel}</span>
            </span>
            <StatusBadge status={r.status} />
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={onContinue}
        className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-amber px-6 font-bold text-slate-deep transition-colors hover:bg-amber-hi"
      >
        {isLast ? (
          <>
            <FileText className="h-4 w-4" aria-hidden="true" /> Generate Dispatch Report
          </>
        ) : (
          <>
            Continue to Step {nextStep} <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </>
        )}
      </button>
    </div>
  );
}
