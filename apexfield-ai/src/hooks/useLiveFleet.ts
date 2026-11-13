"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { mapLiveFleet, type DbSession, type DbTechnician } from "@/lib/live-fleet";

const SESSION_SELECT = `id, org_id, tech_id, status, reported_symptom, current_step_index, safety_disconnect_verified,
  confirmed_root_cause, parts_replaced, ai_summary_report, started_at, completed_at, ended_at, escalation_reason, escalated_at,
  equipment_units ( manufacturer, model_number, equipment_type, refrigerant_type, tonnage ),
  diagnostic_readings ( id, reading_type, numeric_value, unit, is_within_spec, recorded_at ),
  diagnostic_steps ( id, step_number, instruction, expected_target, tech_observation, status, created_at ),
  manager_whispers ( id, body, created_at, delivered_at, author_id )`;

const POLL_MS = 30_000;
const DEBOUNCE_MS = 400;
const TICK_MS = 4_000;

/**
 * The signed-in manager's fleet: technicians plus today's (and any still-open) sessions,
 * scoped by RLS to their org. Realtime postgres_changes trigger a debounced refetch;
 * a slow poll covers dropped sockets. `now` ticks so elapsed timers move.
 */
export function useLiveFleet(sb: SupabaseClient | null, enabled: boolean) {
  const [techs, setTechs] = useState<DbTechnician[]>([]);
  const [sessions, setSessions] = useState<DbSession[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [realtime, setRealtime] = useState<"connecting" | "live" | "offline">("connecting");
  const [now, setNow] = useState(() => Date.now());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchAll = useCallback(async () => {
    if (!sb) return;
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const [t, s] = await Promise.all([
      sb.from("technicians").select("id, full_name, role, experience_years, truck_label, email").order("full_name"),
      sb
        .from("service_sessions")
        .select(SESSION_SELECT)
        // Today's sessions, plus anything still open from the last 24 h (overnight calls).
        .gte("started_at", new Date(Date.now() - 24 * 60 * 60_000).toISOString())
        .or(`status.in.(in_progress,escalated),started_at.gte.${startOfDay.toISOString()}`)
        .order("started_at", { ascending: false })
        .limit(200),
    ]);
    if (t.error || s.error) {
      setError(t.error?.message ?? s.error?.message ?? "Could not load the fleet.");
      setStatus("error");
      return;
    }
    setTechs((t.data ?? []) as DbTechnician[]);
    setSessions((s.data ?? []) as unknown as DbSession[]);
    setError(null);
    setStatus("ready");
    setNow(Date.now());
  }, [sb]);

  const refetchSoon = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void fetchAll(), DEBOUNCE_MS);
  }, [fetchAll]);

  useEffect(() => {
    if (!sb || !enabled) return;
    setStatus((s) => (s === "ready" ? s : "loading"));
    void fetchAll();
    const channel = sb.channel("fleet-live");
    for (const table of ["service_sessions", "diagnostic_readings", "diagnostic_steps", "manager_whispers"]) {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, refetchSoon);
    }
    channel.subscribe((st) => setRealtime(st === "SUBSCRIBED" ? "live" : st === "CLOSED" || st === "CHANNEL_ERROR" || st === "TIMED_OUT" ? "offline" : "connecting"));
    const poll = setInterval(() => void fetchAll(), POLL_MS);
    const tick = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => {
      clearInterval(poll);
      clearInterval(tick);
      if (timer.current) clearTimeout(timer.current);
      void sb.removeChannel(channel);
    };
  }, [sb, enabled, fetchAll, refetchSoon]);

  const fleet = useMemo(() => mapLiveFleet(techs, sessions, now), [techs, sessions, now]);
  return { ...fleet, techs, status, error, realtime, refetch: fetchAll };
}
