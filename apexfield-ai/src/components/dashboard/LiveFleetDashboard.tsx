"use client";

import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { Activity, AlertTriangle, CheckCircle2, Loader2, Radio, ShieldAlert, Truck, Users } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { filterCounts, selectTechs, type FleetFilter } from "@/lib/fleet-sim";
import { useLiveFleet } from "@/hooks/useLiveFleet";
import type { Profile } from "@/hooks/useAuth";
import { DashboardTopBar } from "./DashboardTopBar";
import { Kpi } from "./FleetKpiHeader";
import { FleetControls } from "./FleetControls";
import { TechnicianGrid } from "./TechnicianGrid";
import { SessionInspectorDrawer } from "./SessionInspectorDrawer";
import { TeamPanel } from "./TeamPanel";
import { Toasts, type Toast } from "./Toasts";

/** Real fleet for the signed-in manager's company: Supabase rows, live via Realtime. */
export function LiveFleetDashboard({
  sb,
  profile,
  userId,
  account,
  banner,
}: {
  sb: SupabaseClient;
  profile: Profile;
  userId: string;
  account?: ReactNode;
  banner?: ReactNode;
}) {
  const fleet = useLiveFleet(sb, true);
  const [filter, setFilter] = useState<FleetFilter>("all");
  const [query, setQuery] = useState("");
  const [inspectId, setInspectId] = useState<string | null>(null);
  const [teamOpen, setTeamOpen] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastSeq = useRef(0);

  const pushToast = useCallback((t: Omit<Toast, "id">) => {
    const id = ++toastSeq.current;
    setToasts((prev) => [...prev.slice(-2), { ...t, id }]);
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), 5_000);
  }, []);

  const cards = fleet.cards;
  const counts = useMemo(() => filterCounts(cards), [cards]);
  const visible = useMemo(() => selectTechs(cards, filter, query), [cards, filter, query]);
  const inspected = inspectId ? (cards.find((t) => t.id === inspectId) ?? null) : null;
  const close = useCallback(() => setInspectId(null), []);

  const whisper = useCallback(
    async (id: string, text: string) => {
      const tech = cards.find((t) => t.id === id);
      if (!tech?.live) return;
      const { error } = await sb.from("manager_whispers").insert({ session_id: tech.live.sessionId, org_id: profile.org_id, author_id: userId, body: text.trim() });
      if (error) {
        pushToast({ tone: "dispatch", title: "Couldn't send guidance", body: error.message });
        return;
      }
      pushToast({ tone: "success", title: "Guidance queued for the AI coach", body: `${tech.name} hears it as soon as their live session receives it.` });
      void fleet.refetch();
    },
    [cards, sb, profile.org_id, userId, pushToast, fleet],
  );

  const active = cards.filter((c) => c.status !== "completed").length;
  const completed = cards.filter((c) => c.status === "completed").length;
  const escalated = cards.filter((c) => c.status === "escalated").length;
  const holds = cards.filter((c) => c.status === "safety_hold").length;
  const outOfSpec = cards.reduce((n, c) => n + c.readings.filter((r) => r.status !== "ok").length, 0);
  const attention = escalated + holds;

  return (
    <div className="min-h-screen">
      <DashboardTopBar account={account} />
      <main className="mx-auto flex max-w-[1600px] flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
        {banner}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-1">
            <p className="flex items-center gap-2 font-mono text-[12px] tracking-[0.12em] text-amber">
              LIVE FLEET · {profile.org_name?.toUpperCase() ?? "YOUR COMPANY"}
              <span
                className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold ${
                  fleet.realtime === "live" ? "bg-emerald/15 text-emerald" : "bg-line text-muted"
                }`}
                title={fleet.realtime === "live" ? "Receiving changes in real time" : "Realtime not connected; refreshing every 30 s"}
              >
                <Radio className="h-3 w-3" aria-hidden="true" /> {fleet.realtime === "live" ? "REALTIME" : "POLLING"}
              </span>
            </p>
            <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Today&apos;s field sessions</h1>
          </div>
          <button
            type="button"
            onClick={() => setTeamOpen(true)}
            className="inline-flex min-h-11 items-center gap-2 self-start rounded-xl border border-line-strong px-4 text-sm font-semibold hover:border-amber hover:text-amber sm:self-auto"
          >
            <Users className="h-4 w-4" aria-hidden="true" /> Team ({fleet.techs.length})
          </button>
        </div>

        <section aria-label="Fleet metrics" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <Kpi icon={<Truck className="h-4 w-4" />} label="Active Field Sessions" value={<>{active} <span className="text-muted">/ {cards.length + fleet.idle.length}</span></>} unit="Techs" sub={`${fleet.idle.length} not in a session today`} live={active > 0} />
          <Kpi icon={<CheckCircle2 className="h-4 w-4" />} label="Completed Today" value={completed} unit={completed === 1 ? "Job" : "Jobs"} sub="Root cause confirmed by readings" subTone="emerald" />
          <Kpi icon={<Activity className="h-4 w-4" />} label="Out-of-Spec Readings Today" value={outOfSpec} unit="Readings" sub="Across every session shown" />
          <Kpi
            icon={<ShieldAlert className="h-4 w-4" />}
            label="Active Escalations / Safety Holds"
            value={attention}
            unit={attention === 1 ? "Needs Attention" : "Need Attention"}
            sub={attention ? `${escalated} escalated · ${holds} safety ${holds === 1 ? "hold" : "holds"}` : "All sessions clear"}
            tone={escalated ? "danger" : holds ? "amber" : "calm"}
          />
        </section>

        <FleetControls filter={filter} onFilter={setFilter} counts={counts} query={query} onQuery={setQuery} autoTick={false} onAutoTick={() => {}} showAutoTick={false} />

        {fleet.status === "loading" && (
          <p className="flex items-center gap-2 text-sm text-muted">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading your fleet…
          </p>
        )}
        {fleet.status === "error" && (
          <p role="alert" className="flex items-center gap-2 rounded-xl border border-danger/50 bg-danger/10 px-4 py-3 text-sm text-red-200">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" /> {fleet.error}
          </p>
        )}
        {fleet.status === "ready" && cards.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line-strong p-8 text-center">
            <p className="text-base font-semibold text-ink">No live sessions today yet.</p>
            <p className="mt-1 text-sm text-muted">
              When a technician starts a Live AI session at /demo, their card appears here instantly.{fleet.techs.length <= 1 ? " Add your technicians from Team first." : ""}
            </p>
          </div>
        ) : (
          <TechnicianGrid techs={visible} onInspect={setInspectId} onReset={() => { setFilter("all"); setQuery(""); }} />
        )}

        {fleet.idle.length > 0 && (
          <section aria-label="Technicians not in a session" className="rounded-2xl border border-line bg-steel p-4">
            <p className="font-mono text-[11px] tracking-[0.12em] text-muted">NOT IN A SESSION TODAY · {fleet.idle.length}</p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {fleet.idle.map((t) => (
                <li key={t.id} className="rounded-lg border border-line bg-slate-deep px-2.5 py-1 text-sm text-slate-300">
                  {t.full_name}
                  {t.truck_label && <span className="ml-1.5 font-mono text-[11px] text-amber">{t.truck_label}</span>}
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>

      {inspected && (
        <SessionInspectorDrawer tech={inspected} onClose={close} onWhisper={(id, text) => void whisper(id, text)} onClear={() => {}} onDispatch={() => {}} />
      )}
      {teamOpen && (
        <TeamPanel
          techs={fleet.techs}
          onClose={() => setTeamOpen(false)}
          onAdded={(name) => {
            pushToast({ tone: "success", title: "Technician added", body: `${name} can sign in now.` });
            void fleet.refetch();
          }}
        />
      )}
      <Toasts toasts={toasts} onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))} />
    </div>
  );
}
