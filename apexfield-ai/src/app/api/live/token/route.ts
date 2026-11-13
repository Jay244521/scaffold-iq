import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { DEFAULT_LIVE_MODEL, buildLiveConnectConfig } from "@/lib/ai/hvac-tools";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { guardRequest } from "@/lib/server/request-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Session may run this long on one token; resumed connections reuse a fresh token. */
const SESSION_MINUTES = 30;
/** The browser must open the WebSocket within this window. */
const CONNECT_WINDOW_SECONDS = 60;

/**
 * POST /api/live/token
 * Body: { sessionId?: string, reportedSymptom?: string }  (sessionId: resume a dropped connection)
 *
 * Mints a single-use ephemeral Gemini token locked to the HVAC coach model, system
 * instruction and tool schema. GEMINI_API_KEY never leaves the server.
 */
export async function POST(req: Request) {
  const blocked = guardRequest(req, { key: "live-token", limit: 8, windowMs: 60_000 });
  if (blocked) return blocked;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Live AI is not configured on this server. Set GEMINI_API_KEY in .env.local.", code: "not_configured" },
      { status: 503 },
    );
  }

  let body: { sessionId?: unknown; reportedSymptom?: unknown } = {};
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
  const db = getSupabaseAdmin();
  if (db && !resumeId) {
    // service_sessions.reported_symptom is NOT NULL; live mode doesn't capture a symptom up front.
    // org_id / tech_id stay null until the demo has sign-in (rows are then visible only to the service role).
    const { data, error } = await db
      .from("service_sessions")
      .insert({ reported_symptom: reportedSymptom, status: "in_progress", current_step_index: 1 })
      .select("id")
      .single();
    if (error) console.error("[live/token] service_sessions insert failed:", error.message);
    else sessionId = data.id as string;
  }

  return NextResponse.json(
    { token, model, expiresAt: expireTime, sessionId, persistence: Boolean(db && sessionId) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
