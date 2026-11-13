"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, MonitorPlay, RotateCcw } from "lucide-react";
import { useGeminiLiveSession, type LiveToolHandler } from "@/hooks/useGeminiLiveSession";
import { applyToolCall, initialLiveState, type LiveSessionState } from "@/lib/ai/live-session-state";
import type { HvacToolCall } from "@/lib/ai/hvac-tools";
import { runOemLookup, type LookupRecord } from "@/lib/ai/oem-lookup-client";
import { useAuth } from "@/hooks/useAuth";
import { useManagerWhispers } from "@/hooks/useManagerWhispers";
import { AccountMenu } from "@/components/auth/AccountMenu";
import { DemoTopBar } from "../DemoTopBar";
import { LiveMediaPanel } from "./LiveMediaPanel";
import { BlockedNotice, EquipmentCard, LiveReport, ManualLookups, PersistenceBadge, ReadingsFeed, SafetyCard, StepTracker, TranscriptCard } from "./LiveHud";

export function LiveSession({ modeSwitch, onUseSimulator }: { modeSwitch: ReactNode; onUseSimulator: () => void }) {
  const [state, setState] = useState<LiveSessionState>(initialLiveState);
  // Ref mirrors state so several function calls in one server message apply in order.
  const stateRef = useRef<LiveSessionState>(initialLiveState);
  const sessionIdRef = useRef<string | null>(null);
  const persistChain = useRef<Promise<void>>(Promise.resolve());
  const [persistError, setPersistError] = useState(false);

  /** Fire-and-forget, strictly ordered writes (equipment row must exist before readings reference the session). */
  const persist = useCallback((call: HvacToolCall) => {
    const sessionId = sessionIdRef.current;
    if (!sessionId) return;
    persistChain.current = persistChain.current.then(async () => {
      try {
        const res = await fetch("/api/live/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, name: call.name, args: call.args }),
        });
        if (!res.ok) setPersistError(true);
      } catch {
        setPersistError(true);
      }
    });
  }, []);

  const [lookups, setLookups] = useState<LookupRecord[]>([]);

  const onToolCall = useCallback<LiveToolHandler>(
    async (call) => {
      // Read-only manual search: scoped to the registered unit, never persisted, no state change.
      if (call.name === "lookup_oem_spec") {
        const { response, record } = await runOemLookup(call.args, stateRef.current.equipment);
        setLookups((prev) => [...prev, record].slice(-12));
        return response;
      }
      const outcome = applyToolCall(stateRef.current, call.name, call.args);
      stateRef.current = outcome.state;
      setState(outcome.state);
      if (outcome.accepted) persist(outcome.accepted);
      return outcome.response;
    },
    [persist],
  );

  const live = useGeminiLiveSession({ onToolCall });
  const auth = useAuth();

  // Manager whispers for this session go straight into the coach once it's live.
  useManagerWhispers(auth.supabase, live.sessionInfo?.sessionId ?? null, live.status === "active", live.sendManagerNote);

  const startBlocked =
    auth.status === "loading"
      ? { message: "Checking your account…" }
      : auth.status === "signed_out"
        ? { message: "Sign in with your technician account to start a live session.", href: "/login?next=%2Fdemo%3Fmode%3Dlive", cta: "Sign in" }
        : auth.status === "signed_in" && !auth.profile
          ? { message: "Your account isn't linked to a company yet. Ask your service manager to add you." }
          : null;

  useEffect(() => {
    sessionIdRef.current = live.sessionInfo?.sessionId ?? null;
  }, [live.sessionInfo]);

  const begin = useCallback(() => {
    stateRef.current = initialLiveState;
    setState(initialLiveState);
    setLookups([]);
    setPersistError(false);
    void live.start();
  }, [live]);

  const newCall = useCallback(() => {
    live.stop();
    begin();
  }, [begin, live]);

  const e = state.equipment;
  const equipmentLabel = e ? `${e.manufacturer.toUpperCase()} ${e.model_number}` : null;

  return (
    <div className="min-h-screen">
      <DemoTopBar onReset={live.stop} canReset={live.status === "active" || live.status === "connecting"} resetLabel="End Session" />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-8 sm:py-12">
        {modeSwitch}

        <div className="mb-5 flex flex-col gap-1 sm:mb-6">
          <p className="hidden font-mono text-[13px] tracking-[0.1em] text-amber sm:block">LIVE MULTIMODAL COACHING · GEMINI LIVE API</p>
          <h1 className="text-xl font-extrabold tracking-tight sm:text-3xl">Run a real call with a master tech in your ear.</h1>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <PersistenceBadge info={live.sessionInfo} />
            <AccountMenu auth={auth} next="/demo?mode=live" />
          </div>
        </div>

        {live.status === "error" && live.error && (
          <div role="alert" className="mb-6 flex flex-col gap-3 rounded-2xl border border-danger/60 bg-danger/10 p-4 sm:flex-row sm:items-center">
            <AlertTriangle className="h-5 w-5 shrink-0 text-danger" aria-hidden="true" />
            <p className="flex-1 text-sm text-slate-200">{live.error}</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={begin}
                className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-amber px-4 text-sm font-bold text-slate-deep hover:bg-amber-hi"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" /> Try again
              </button>
              <button
                type="button"
                onClick={onUseSimulator}
                className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-line-strong px-4 text-sm font-semibold hover:border-amber hover:text-amber"
              >
                <MonitorPlay className="h-4 w-4" aria-hidden="true" /> Use Simulator
              </button>
            </div>
          </div>
        )}

        {persistError && (
          <p role="status" className="mb-4 rounded-xl border border-amber/40 bg-amber/10 px-4 py-2.5 text-sm text-amber-hi">
            Some session events could not be saved. The live call is unaffected.
          </p>
        )}

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
          <div className="flex flex-col gap-5 lg:sticky lg:top-24 lg:self-start">
            <LiveMediaPanel
              videoRef={live.videoRef}
              status={live.status}
              reconnecting={live.reconnecting}
              cameraActive={live.cameraActive}
              cameraError={live.cameraError}
              micMuted={live.micMuted}
              inputLevel={live.inputLevel}
              aiSpeaking={live.aiSpeaking}
              torchSupported={live.torchSupported}
              torchOn={live.torchOn}
              scanFlash={live.scanFlash}
              captions={live.captions}
              equipmentLabel={equipmentLabel}
              onStart={begin}
              startBlocked={startBlocked}
              onStop={live.stop}
              onScan={live.scanDataPlate}
              onToggleMute={live.toggleMute}
              onToggleTorch={live.toggleTorch}
            />
          </div>

          <div className="flex flex-col gap-5">
            {state.completion ? (
              <LiveReport state={state} onNewSession={newCall} />
            ) : (
              <>
                <BlockedNotice blocked={state.safety.verified ? state.blocked.filter((b) => !b.reason.startsWith("SAFETY GATE")) : state.blocked} />
                <EquipmentCard equipment={state.equipment} />
                <SafetyCard safety={state.safety} />
                <StepTracker state={state} />
              </>
            )}
            <ReadingsFeed readings={state.readings} />
            <ManualLookups lookups={lookups} />
            <TranscriptCard captions={live.captions} />
          </div>
        </div>
      </main>
    </div>
  );
}
