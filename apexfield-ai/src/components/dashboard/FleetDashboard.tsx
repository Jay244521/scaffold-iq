"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from "react";
import { TICK_MS, filterCounts, fleetReducer, initialFleetState, selectTechs, type FleetFilter } from "@/lib/fleet-sim";
import { DashboardTopBar } from "./DashboardTopBar";
import { FleetKpiHeader } from "./FleetKpiHeader";
import { FleetControls } from "./FleetControls";
import { TechnicianGrid } from "./TechnicianGrid";
import { SessionInspectorDrawer } from "./SessionInspectorDrawer";
import { Toasts, type Toast } from "./Toasts";

const TOAST_MS = 5_000;

/** Demo board: 12 simulated DFW technicians. Shown to visitors and as the demo mode for managers. */
export function FleetDashboard({ account, banner }: { account?: ReactNode; banner?: ReactNode } = {}) {
  const [state, dispatch] = useReducer(fleetReducer, undefined, initialFleetState);
  const [filter, setFilter] = useState<FleetFilter>("all");
  const [query, setQuery] = useState("");
  const [autoTick, setAutoTick] = useState(true);
  const [inspectId, setInspectId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastSeq = useRef(0);

  useEffect(() => {
    if (!autoTick) return;
    const id = setInterval(() => dispatch({ type: "tick" }), TICK_MS);
    return () => clearInterval(id);
  }, [autoTick]);

  const pushToast = useCallback((t: Omit<Toast, "id">) => {
    const id = ++toastSeq.current;
    setToasts((prev) => [...prev.slice(-2), { ...t, id }]);
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), TOAST_MS);
  }, []);

  const techs = state.techs;
  const counts = useMemo(() => filterCounts(techs), [techs]);
  const visible = useMemo(() => selectTechs(techs, filter, query), [techs, filter, query]);
  const inspected = inspectId ? techs.find((t) => t.id === inspectId) ?? null : null;

  const close = useCallback(() => setInspectId(null), []);

  const whisper = useCallback(
    (id: string, text: string) => {
      const tech = techs.find((t) => t.id === id);
      dispatch({ type: "whisper", id, text });
      if (tech) pushToast({ tone: "success", title: "Guidance sent to AI Coach", body: `Relaying to ${tech.name}'s headset (${tech.truck}).` });
    },
    [techs, pushToast],
  );

  const clear = useCallback(
    (id: string) => {
      const tech = techs.find((t) => t.id === id);
      dispatch({ type: "clear", id });
      if (tech)
        pushToast({
          tone: "success",
          title: tech.status === "safety_hold" ? "Safety hold cleared" : "Escalation approved",
          body: `${tech.name} is back to coaching on ${tech.truck}.`,
        });
    },
    [techs, pushToast],
  );

  const dispatchBackup = useCallback(
    (id: string) => {
      const tech = techs.find((t) => t.id === id);
      if (!tech || tech.backupDispatched) return;
      dispatch({ type: "dispatch", id });
    },
    [techs],
  );

  // Announce a dispatch once the reducer has assigned the senior tech + ETA.
  const lastDispatch = state.dispatches[state.dispatches.length - 1];
  const announced = useRef<string | null>(null);
  useEffect(() => {
    if (!lastDispatch || announced.current === lastDispatch.id) return;
    announced.current = lastDispatch.id;
    const tech = techs.find((t) => t.id === lastDispatch.techId);
    pushToast({
      tone: "dispatch",
      title: "Senior tech backup dispatched",
      body: `${lastDispatch.senior} (${lastDispatch.seniorTruck}) → ${tech?.customer ?? "job site"}, ETA ${lastDispatch.etaMin} min. Logged as a second-truck dispatch.`,
    });
  }, [lastDispatch, techs, pushToast]);

  return (
    <div className="min-h-screen">
      <DashboardTopBar account={account} />
      <main className="mx-auto flex max-w-[1600px] flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
        {banner}
        <div className="flex flex-col gap-1">
          <p className="font-mono text-[12px] tracking-[0.12em] text-amber">SERVICE MANAGER · FLEET COMMAND</p>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">DFW field sessions, live.</h1>
          <p className="text-sm text-muted">
            {techs.length} technicians across Dallas, Plano, Irving, Mesquite, Garland and Arlington. Escalations and safety holds sort to the top.
          </p>
        </div>

        <FleetKpiHeader techs={techs} />
        <FleetControls
          filter={filter}
          onFilter={setFilter}
          counts={counts}
          query={query}
          onQuery={setQuery}
          autoTick={autoTick}
          onAutoTick={setAutoTick}
        />
        <p className="sr-only" aria-live="polite">
          Showing {visible.length} of {techs.length} technicians
        </p>
        <TechnicianGrid
          techs={visible}
          onInspect={setInspectId}
          onReset={() => {
            setFilter("all");
            setQuery("");
          }}
        />
      </main>

      {inspected && (
        <SessionInspectorDrawer tech={inspected} onClose={close} onWhisper={whisper} onClear={clear} onDispatch={dispatchBackup} />
      )}
      <Toasts toasts={toasts} onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))} />
    </div>
  );
}
