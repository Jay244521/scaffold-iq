"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ReceivedWhisper = { id: string; body: string; created_at: string };

/**
 * Delivers service-manager whispers for one live session into the coach.
 *
 * Subscribes to manager_whispers INSERTs for the session (Supabase Realtime, RLS-checked),
 * also picks up anything sent before the subscription was live, queues whispers until the
 * Gemini session can accept them, hands each one to `deliver` exactly once, then stamps
 * delivered_at so the manager's dashboard shows it arrived.
 */
export function useManagerWhispers(
  sb: SupabaseClient | null,
  sessionId: string | null,
  ready: boolean,
  deliver: (body: string) => boolean,
) {
  const pending = useRef<ReceivedWhisper[]>([]);
  const handled = useRef(new Set<string>());
  const [received, setReceived] = useState<ReceivedWhisper[]>([]);
  const deliverRef = useRef(deliver);
  useEffect(() => {
    deliverRef.current = deliver;
  }, [deliver]);
  const readyRef = useRef(ready);

  const flush = useCallback(() => {
    if (!sb || !readyRef.current) return;
    const still: ReceivedWhisper[] = [];
    for (const w of pending.current) {
      if (deliverRef.current(w.body)) {
        setReceived((prev) => [...prev, w].slice(-20));
        // PostgREST builders are lazy: .then() is what actually sends the request.
        sb.from("manager_whispers")
          .update({ delivered_at: new Date().toISOString() })
          .eq("id", w.id)
          .then(({ error }) => error && console.warn("[whispers] could not mark delivered:", error.message));
      } else still.push(w);
    }
    pending.current = still;
  }, [sb]);

  const enqueue = useCallback(
    (w: ReceivedWhisper) => {
      if (handled.current.has(w.id)) return;
      handled.current.add(w.id);
      pending.current.push(w);
      flush();
    },
    [flush],
  );

  useEffect(() => {
    readyRef.current = ready;
    if (ready) flush();
  }, [ready, flush]);

  useEffect(() => {
    if (!sb || !sessionId) return;
    let cancelled = false;
    const channel = sb
      .channel(`whispers:${sessionId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "manager_whispers", filter: `session_id=eq.${sessionId}` },
        (payload) => enqueue(payload.new as ReceivedWhisper),
      )
      .subscribe();
    // Catch up on whispers sent before the subscription was live.
    void sb
      .from("manager_whispers")
      .select("id, body, created_at")
      .eq("session_id", sessionId)
      .is("delivered_at", null)
      .order("created_at")
      .then(({ data }) => {
        if (!cancelled) for (const w of (data ?? []) as ReceivedWhisper[]) enqueue(w);
      });
    return () => {
      cancelled = true;
      void sb.removeChannel(channel);
    };
  }, [sb, sessionId, enqueue]);

  return { received };
}
