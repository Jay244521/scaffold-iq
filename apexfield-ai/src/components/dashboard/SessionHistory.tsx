"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Download, Loader2, Search } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { SESSION_SELECT } from "@/hooks/useLiveFleet";
import { mapSessionToTechnician, type DbSession, type DbTechnician } from "@/lib/live-fleet";
import { sessionsToCsv } from "@/lib/session-export";
import { AccountMenu } from "@/components/auth/AccountMenu";
import { DashboardTopBar } from "./DashboardTopBar";
import { SessionInspectorDrawer } from "./SessionInspectorDrawer";
import { StatusBadge, formatElapsed } from "./fleet-ui";

const RANGES = [
  { id: "7", label: "Last 7 days", days: 7 },
  { id: "30", label: "Last 30 days", days: 30 },
  { id: "90", label: "Last 90 days", days: 90 },
] as const;
const MAX_ROWS = 1000;

/** Manager-only: past sessions with filters, the inspector, and CSV export. */
export function SessionHistory() {
  const auth = useAuth();
  const sb = auth.supabase;
  const isManager = auth.status === "signed_in" && auth.isManager && auth.profile !== null;
  const [range, setRange] = useState<(typeof RANGES)[number]["id"]>("7");
  const [techFilter, setTechFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [techs, setTechs] = useState<DbTechnician[]>([]);
  const [sessions, setSessions] = useState<DbSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inspectId, setInspectId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!sb || !isManager) return;
    setLoading(true);
    const days = RANGES.find((r) => r.id === range)!.days;
    const since = new Date(Date.now() - days * 24 * 60 * 60_000).toISOString();
    const [t, s] = await Promise.all([
      sb.from("technicians").select("id, full_name, role, experience_years, truck_label, email, deactivated_at").order("full_name"),
      sb.from("service_sessions").select(SESSION_SELECT).gte("started_at", since).order("started_at", { ascending: false }).limit(MAX_ROWS),
    ]);
    setLoading(false);
    if (t.error || s.error) return setError(t.error?.message ?? s.error?.message ?? "Could not load sessions.");
    setError(null);
    setTechs((t.data ?? []) as DbTechnician[]);
    setSessions((s.data ?? []) as unknown as DbSession[]);
  }, [sb, isManager, range]);

  useEffect(() => {
    void load();
  }, [load]);

  const now = Date.now();
  const techById = useMemo(() => new Map(techs.map((t) => [t.id, t])), [techs]);
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sessions
      .filter((s) => s.tech_id && techById.has(s.tech_id))
      .map((s) => ({ raw: s, view: mapSessionToTechnician(techById.get(s.tech_id!)!, s, now) }))
      .filter(({ raw, view }) =>
        (techFilter === "all" || raw.tech_id === techFilter) &&
        (statusFilter === "all" || view.status === statusFilter) &&
        (!q || [view.name, view.customer, view.equipment.brand, view.equipment.model, raw.confirmed_root_cause ?? ""].some((f) => f.toLowerCase().includes(q))),
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions, techById, techFilter, statusFilter, query]);

  const inspected = inspectId ? rows.find((r) => r.view.id === inspectId)?.view ?? null : null;
  const close = useCallback(() => setInspectId(null), []);

  const exportCsv = () => {
    const csv = sessionsToCsv(rows.map((r) => r.raw), techs);
    const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `apexfield-sessions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const completed = rows.filter((r) => r.view.status === "completed").length;
  const escalated = rows.filter((r) => r.raw.escalation_reason).length;

  return (
    <div className="min-h-screen">
      <DashboardTopBar account={<AccountMenu auth={auth} next="/dashboard/history" />} />
      <main className="mx-auto flex max-w-[1600px] flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
        <Link href="/dashboard" className="inline-flex items-center gap-1.5 self-start text-sm text-slate-300 hover:text-amber">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Live fleet
        </Link>
        <div className="flex flex-col gap-1">
          <p className="font-mono text-[12px] tracking-[0.12em] text-amber">SESSION HISTORY{auth.status === "signed_in" && auth.profile?.org_name ? ` · ${auth.profile.org_name.toUpperCase()}` : ""}</p>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Every call, on the record.</h1>
        </div>

        {auth.status === "loading" ? (
          <p className="flex items-center gap-2 text-sm text-muted"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading…</p>
        ) : !isManager ? (
          <p className="rounded-xl border border-amber/40 bg-amber/10 px-4 py-3 text-sm text-amber-hi">
            Session history is for service managers.{" "}
            {auth.status === "signed_out" ? <Link href="/login?next=%2Fdashboard%2Fhistory" className="font-semibold underline">Sign in</Link> : null}
          </p>
        ) : (
          <>
            <section aria-label="Filters" className="flex flex-col gap-3 rounded-2xl border border-line bg-steel p-3 sm:p-4 lg:flex-row lg:items-center">
              <div role="radiogroup" aria-label="Date range" className="flex gap-1.5">
                {RANGES.map((r) => (
                  <button key={r.id} type="button" role="radio" aria-checked={range === r.id} onClick={() => setRange(r.id)}
                    className={`min-h-10 rounded-full border px-3.5 text-sm font-semibold ${range === r.id ? "border-amber bg-amber text-slate-deep" : "border-line-strong text-slate-300 hover:border-amber"}`}>
                    {r.label}
                  </button>
                ))}
              </div>
              <select aria-label="Technician" value={techFilter} onChange={(e) => setTechFilter(e.target.value)} className="h-10 rounded-lg border border-line-strong bg-slate-deep px-2.5 text-sm text-ink">
                <option value="all">All technicians</option>
                {techs.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
              </select>
              <select aria-label="Status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-10 rounded-lg border border-line-strong bg-slate-deep px-2.5 text-sm text-ink">
                <option value="all">All statuses</option>
                <option value="completed">Completed</option>
                <option value="ended">Ended early</option>
                <option value="escalated">Escalated (open)</option>
                <option value="coaching">In progress</option>
                <option value="safety_hold">Safety hold</option>
              </select>
              <label className="relative flex-1">
                <span className="sr-only">Search sessions</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
                <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search symptom, brand, model or root cause"
                  className="h-10 w-full rounded-lg border border-line-strong bg-slate-deep pl-9 pr-3 text-sm text-ink placeholder:text-muted focus:border-amber focus:outline-none" />
              </label>
              <button type="button" onClick={exportCsv} disabled={!rows.length}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-amber px-4 text-sm font-bold text-slate-deep hover:bg-amber-hi disabled:opacity-50">
                <Download className="h-4 w-4" aria-hidden="true" /> Export CSV
              </button>
            </section>

            <p className="font-mono text-xs text-muted">
              {rows.length} session{rows.length === 1 ? "" : "s"} · {completed} completed · {escalated} escalated
              {sessions.length >= MAX_ROWS ? ` · showing the latest ${MAX_ROWS}` : ""}
            </p>
            {error && <p role="alert" className="rounded-xl border border-danger/50 bg-danger/10 px-4 py-3 text-sm text-red-200">{error}</p>}
            {loading && <p className="flex items-center gap-2 text-sm text-muted"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading sessions…</p>}

            <div className="overflow-x-auto rounded-2xl border border-line">
              <table className="w-full min-w-[860px] text-left text-sm">
                <thead className="bg-steel-2 font-mono text-[10px] tracking-[0.1em] text-muted">
                  <tr>
                    {["STARTED", "TECHNICIAN", "STATUS", "EQUIPMENT", "SYMPTOM / ROOT CAUSE", "READINGS", "DURATION"].map((h) => (
                      <th key={h} scope="col" className="px-3 py-2.5 font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ raw, view }) => (
                    <tr key={view.id} onClick={() => setInspectId(view.id)} className="cursor-pointer border-t border-line bg-steel hover:bg-steel-2">
                      <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs text-slate-300">
                        <button type="button" onClick={(e) => { e.stopPropagation(); setInspectId(view.id); }} className="text-left hover:text-amber" aria-label={`Inspect ${view.name}'s session`}>
                          {new Date(raw.started_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                        </button>
                      </td>
                      <td className="px-3 py-2.5 text-ink">{view.name}<span className="ml-1.5 font-mono text-[11px] text-amber">{view.truck !== "NO TRUCK" ? view.truck : ""}</span></td>
                      <td className="px-3 py-2.5"><StatusBadge status={view.status} /></td>
                      <td className="px-3 py-2.5 font-mono text-xs text-slate-300">{raw.equipment_units ? `${raw.equipment_units.manufacturer} ${raw.equipment_units.model_number}` : "—"}</td>
                      <td className="max-w-[22rem] px-3 py-2.5 text-slate-300">
                        <span className="line-clamp-1">{raw.reported_symptom}</span>
                        {raw.confirmed_root_cause && <span className="line-clamp-1 text-emerald">→ {raw.confirmed_root_cause}</span>}
                        {raw.escalation_reason && !raw.confirmed_root_cause && <span className="line-clamp-1 text-red-300">⚑ {raw.escalation_reason}</span>}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-xs text-slate-300">
                        {raw.diagnostic_readings.length}
                        {view.readings.some((r) => r.status !== "ok") && <span className="ml-1 text-amber-hi">({view.readings.filter((r) => r.status !== "ok").length} out)</span>}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-xs text-slate-300">{formatElapsed(view.elapsedSec)}</td>
                    </tr>
                  ))}
                  {!loading && rows.length === 0 && (
                    <tr><td colSpan={7} className="bg-steel px-3 py-8 text-center text-sm text-muted">No sessions in this range.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
      {inspected && (
        <SessionInspectorDrawer tech={inspected} onClose={close} onWhisper={() => {}} onClear={() => {}} onDispatch={() => {}} />
      )}
    </div>
  );
}
