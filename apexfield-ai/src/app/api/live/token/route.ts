import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { DEFAULT_LIVE_MODEL, buildLiveConnectConfig } from "@/lib/ai/hvac-tools";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { allowAnonymousLive, getAuthContext } from "@/lib/supabase/server-auth";
import { guardRequest } from "@/lib/server/request-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Session may run this long on one token; resumed connections reuse a fresh token. */
const SESSION_MINUTES = 30;
/** The browser must open the WebSocket within this window. */
const CONNECT_WINDOW_SECONDS = 60;
/** Cost guardrail: live sessions a company may start per day (override with LIVE_MAX_SESSIONS_PER_ORG_PER_DAY). */
const MAX_SESSIONS_PER_ORG_PER_DAY = Number(process.env.LIVE_MAX_SESSIONS_PER_ORG_PER_DAY) || 60;

/**
 * POST /api/live/token
 * Body: { sessionId?: string, reportedSymptom?: string }  (sessionId: resume a dropped connection)
 *
 * Requires a signed-in technician (unless LIVE_DEMO_ALLOW_ANONYMOUS=true for local
 * development). Creates the service_sessions row under the tech's org and id, then
 * mints a single-use ephemeral Gemini token locked to the HVAC coach model, system
 * instruction and tool schema. GEMINI_API_KEY never leaves the server.
 */
export async function POST(req: Request) {
  // Auth first: never mint a token (or spend quota) for an unknown caller.
  const auth = await getAuthContext();
  if (!auth?.tech && !allowAnonymousLive()) {
    const linked = auth && !auth.tech;
    return NextResponse.json(
      {
        error: linked ? "Your account isn't linked to a company yet. Ask your service manager to add you." : "Sign in to start a live AI session.",
        code: "auth_required",
      },
      { status: 401 },
    );
  }

  const blocked = guardRequest(req, { key: "live-token", limit: 8, windowMs: 60_000, subject: auth?.user.id });
  if (blocked) return blocked;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Live AI is not configured on this server. Set GEMINI_API_KEY in .env.local.", code: "not_configured" },
      { status: 503 },
    );
  }

  let body: { sessionId?: unknown; reportedSymptom?: unknown; consentAcknowledged?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    /* empty body is fine */
  }
  const resumeId = typeof body.sessionId === "string" && UUID.test(body.sessionId) ? body.sessionId : null;
  const reportedSymptom =
    typeof body.reportedSymptom === "string" && body.reportedSymptom.trim()
      ? body.reportedSymptom.trim().slice(0, 500)
      : "Not reported (live AI coaching session)";

  // New signed-in sessions need the technician's daily safety + consent acknowledgment.
  if (auth?.tech && !resumeId && body.consentAcknowledged !== true) {
    return NextResponse.json(
      { error: "Confirm the customer consent and safety acknowledgment before starting.", code: "consent_required" },
      { status: 400 },
    );
  }

  // Cost guardrail: cap new sessions per company per day.
  if (auth?.tech && !resumeId) {
    const since = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
    const { count } = await auth.supabase
      .from("service_sessions")
      .select("id", { count: "exact", head: true })
      .eq("org_id", auth.tech.org_id)
      .gte("started_at", since);
    if ((count ?? 0) >= MAX_SESSIONS_PER_ORG_PER_DAY) {
      return NextResponse.json(
        { error: `Your company has reached today's limit of ${MAX_SESSIONS_PER_ORG_PER_DAY} live sessions. Contact ApexField to raise it.`, code: "daily_limit" },
        { status: 429 },
      );
    }
  }

  // Resuming: the session must belong to this technician.
  if (resumeId && auth?.tech) {
    const { data: own } = await auth.supabase.from("service_sessions").select("id").eq("id", resumeId).eq("tech_id", auth.user.id).maybeSingle();
    if (!own) return NextResponse.json({ error: "That session isn't yours to resume." }, { status: 403 });
  }

  const model = process.env.GEMINI_LIVE_MODEL || DEFAULT_LIVE_MODEL;
  const now = Date.now();
  const expireTime = new Date(now + SESSION_MINUTES * 60_000).toISOString();

  let token: string | undefined;
  try {
    const ai = new GoogleGenAI({ apiKey, httpOptions: { apiVersion: "v1alpha" } });
    const created = await ai.authTokens.create({
      config: {
        uses: 1,
        expireTime,
        newSessionExpireTime: new Date(now + CONNECT_WINDOW_SECONDS * 1000).toISOString(),
        // Lock model + every field we set (prompt, tools, modalities). The browser
        // may only add unset fields such as sessionResumption.handle.
        liveConnectConstraints: { model, config: buildLiveConnectConfig() },
        lockAdditionalFields: [],
        httpOptions: { apiVersion: "v1alpha" },
      },
    });
    token = created.name;
  } catch (e) {
    console.error("[live/token] authTokens.create failed:", e);
    return NextResponse.json({ error: "Could not start a live AI session. Try again." }, { status: 502 });
  }
  if (!token) return NextResponse.json({ error: "Gemini returned no token." }, { status: 502 });

  // Persistence is optional: a missing or failing Supabase never blocks the session.
  let sessionId: string | null = resumeId;
  let persistence = false;
  if (auth?.tech) {
    // Signed in: insert as the user so RLS checks the org; the session is owned by this tech.
    if (!resumeId) {
      // One live session per tech: close anything they left open (app killed, phone died).
      await auth.supabase
        .from("service_sessions")
        .update({ status: "ended", ended_at: new Date().toISOString() })
        .eq("tech_id", auth.user.id)
        .in("status", ["in_progress", "escalated"]);
      const { data, error } = await auth.supabase
        .from("service_sessions")
        .insert({
          org_id: auth.tech.org_id,
          tech_id: auth.user.id,
          reported_symptom: reportedSymptom,
          status: "in_progress",
          current_step_index: 1,
          consent_acknowledged_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (error) console.error("[live/token] service_sessions insert failed:", error.message);
      else sessionId = data.id as string;
    }
    persistence = Boolean(sessionId);
  } else {
    // Anonymous local-dev mode: org-less rows written with the service role, if configured.
    const db = getSupabaseAdmin();
    if (db && !resumeId) {
      const { data, error } = await db
        .from("service_sessions")
        .insert({ reported_symptom: reportedSymptom, status: "in_progress", current_step_index: 1 })
        .select("id")
        .single();
      if (error) console.error("[live/token] service_sessions insert failed:", error.message);
      else sessionId = data.id as string;
    }
    persistence = Boolean(db && sessionId);
  }

  return NextResponse.json(
    { token, model, expiresAt: expireTime, sessionId, persistence },
    { headers: { "Cache-Control": "no-store" } },
  );
}
