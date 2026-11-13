# ApexField AI — Marketing Site

Single-page marketing site built with Next.js 15 (App Router), TypeScript, Tailwind CSS v4 and lucide-react.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # production build
npm run typecheck  # tsc --noEmit
```

## Structure

```
src/app/
  layout.tsx        Inter + JetBrains Mono via next/font, #0B0F19 global background
  globals.css       Tailwind v4 @theme brand tokens (colors, fonts, animations)
  page.tsx          Assembles the sections inside <DemoModalProvider>
src/components/landing/
  Navbar.tsx            Sticky glass header, smooth-scroll links, mobile menu
  HeroSection.tsx       Split hero + phone field-HUD mockup with animated waveform
  ProblemStatsBar.tsx   3-column cost-of-callbacks stat bar
  HowItWorks.tsx        4-stage tab selector with a live preview per stage
  RoiCalculator.tsx     Client-side fleet savings calculator
  FieldBuiltSection.tsx 4-card "built for the field" grid
  PricingAndFaq.tsx     3-tier pricing + FAQ accordion
  DemoModal.tsx         Demo booking modal, context provider and <DemoButton>
  Footer.tsx            Final CTA band, DFW HQ badge, links, copyright
  Logo.tsx, SectionHeading.tsx, navLinks.ts   shared pieces
```

## Live Camera & Voice mode (Gemini Multimodal Live API)

`/demo` has a mode switch at the top. Phones and tablets open in **Live Camera & Voice (Real AI)**; desktops open in **Guided Browser Simulator (No Mic/Cam)**. Add `?mode=live` or `?mode=sim` to force a mode.

### Setup

```bash
cp .env.example .env.local
# GEMINI_API_KEY=...              required for live mode (server-only)
# SUPABASE_URL=... / SUPABASE_SERVICE_ROLE_KEY=...   optional persistence
```

Camera and microphone need a secure context: `http://localhost` works for development. To test on a phone, deploy (e.g. a Vercel preview) or tunnel over HTTPS.

For persistence, set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. Without them the live session still runs; tool calls just aren't saved.

**Database.** `supabase/migrations/` mirrors what is applied to the Supabase project, with the same versions: the coaching schema, RLS, hardening, and the OEM vector migration. The project also holds tables for other apps (for example `aura_waitlist` and `dfw_leads`) that aren't tracked here, so apply new ApexField migrations with the Supabase SQL editor or MCP rather than `supabase db push`.

How live tool calls map onto the schema (`src/lib/ai/persist-live-event.ts`):

| Tool call | Writes |
|---|---|
| session start (`/api/live/token`) | `service_sessions` row (`reported_symptom` defaults to "Not reported (live AI coaching session)") |
| `register_equipment_plate` | reuses or inserts `equipment_units` (type normalized to `split_ac`/`heat_pump`/`gas_furnace`/`rtu`), sets `service_sessions.equipment_id` |
| `verify_safety_disconnect` | `service_sessions.safety_disconnect_verified`, plus a step-3 `diagnostic_steps` row recording how it was verified |
| `log_diagnostic_reading` | `diagnostic_readings` (unit normalized to `psi`/`degF`/`amps`/`volts`/`inWC`/`uF`, value rounded to 2 dp) |
| `advance_diagnostic_step` | `diagnostic_steps` (`in_progress` → `pending`) and `service_sessions.current_step_index` |
| `complete_service_session` | `service_sessions` status `completed`, `confirmed_root_cause`, `parts_replaced`, `ai_summary_report`, `completed_at` |

Sessions are created with the signed-in technician's `org_id` and `tech_id`, so the org-scoped RLS policies apply. Only anonymous local-dev sessions (`LIVE_DEMO_ALLOW_ANONYMOUS=true`) have null org and tech. A reading's `target_spec_note` has no column in `diagnostic_readings`; it stays in the live transcript.

### How it works

```
Browser                                           Server (Next.js route handlers)
───────                                           ───────────────────────────────
POST /api/live/token  ──────────────────────────▶ authTokens.create()  (GEMINI_API_KEY stays here)
                       ◀── single-use ephemeral   token locked to model + system prompt + tools
                           token, 60 s to connect, (lockAdditionalFields: [])
                           30 min session          + inserts service_sessions row
WebSocket (BidiGenerateContentConstrained) ◀────▶ Gemini Live
  mic   → AudioWorklet → 16 kHz Int16 PCM, 100 ms chunks   (realtimeInput.audio)
  camera→ canvas → JPEG 768 px q0.7 @ 1 FPS                (realtimeInput.video)
          Scan Data Plate → JPEG 1280 px q0.85 + prompt
  model → 24 kHz PCM → gapless Web Audio queue; flushed on serverContent.interrupted (barge-in)
  toolCall → applyToolCall() (deterministic gate) → sendToolResponse
           → POST /api/live/events ─────────────────▶ Supabase (service role)
```

| File | Role |
|---|---|
| `src/lib/ai/hvac-tools.ts` | System instruction, the 5 function declarations, Live config, strict argument validators (shared by client and server) |
| `src/lib/ai/live-session-state.ts` | Pure state machine that accepts or **rejects** each tool call |
| `src/lib/ai/audio.ts` | PCM capture worklet (any device rate → 16 kHz), ScriptProcessor fallback, PCM/base64 helpers |
| `src/hooks/useGeminiLiveSession.ts` | Connection lifecycle (`idle` / `connecting` / `active` / `error`), media capture, playback, barge-in, torch, mute, session resumption, cleanup on unmount |
| `src/app/api/live/token/route.ts` | Mints the ephemeral token; same-origin check + per-IP rate limit |
| `src/app/api/live/events/route.ts` | Re-validates and persists accepted tool calls |
| `src/components/demo/live/*` | Camera viewport, controls, level meter, HUD, dispatch report |

**Safety is enforced in code, not just in the prompt.** `applyToolCall` returns an `error` to the model (and shows "AI action blocked" in the HUD) when it tries to log a capacitance reading or start step 4+ before `verify_safety_disconnect` succeeds, close the call with no readings, or act after the call is complete. Bad arguments (unknown enum, non-numeric value, missing field) are rejected the same way.

**Session length.** Context-window compression is on (audio+video sessions otherwise end at ~2 min). When the server rotates the connection, the hook mints a new token and resumes with the last `sessionResumption` handle, up to 3 times in a row.

**Model.** Defaults to `gemini-2.5-flash-native-audio-preview-09-2025`; set `GEMINI_LIVE_MODEL` to change it. The SDK sends audio/video as `realtimeInput.audio` / `realtimeInput.video`, which replaced the deprecated `mediaChunks` field.

**Abuse limits.** The token route allows 8 requests per minute per IP, in memory, so the limit is per server instance. Before a public launch, put the demo behind sign-in or an edge rate limiter so strangers can't spend your Gemini quota.

## Accounts, live fleet and manager whispers

**Sign-in (Supabase Auth, email + password)**
- `/signup` creates a company (`organizations`), its first user and that user's `technicians` row with role `admin`, the service manager. Accounts are created confirmed through the service role (`/api/auth/signup`), so there's no email round-trip.
- `/login` sends managers (`admin`, `lead_tech`) to `/dashboard` and technicians to `/demo?mode=live`.
- Managers add technicians from **Dashboard → Team** (`/api/team`) with a temporary password, role (`apprentice` / `tech` / `lead_tech`), years of experience and truck.
- `src/middleware.ts` keeps the auth cookie fresh. Server code reads the user with `getAuthContext()` (`src/lib/supabase/server-auth.ts`); the browser uses `useAuth()`.

**Live AI is signed-in only**
- `/api/live/token` refuses anonymous callers before it mints a Gemini token. Sessions are created with the tech's `org_id` and `tech_id`, through RLS.
- `/api/live/events` only writes into a session the caller owns, as that user. `/api/live/lookup` requires sign-in too.
- For local development without accounts, set `LIVE_DEMO_ALLOW_ANONYMOUS=true`.

**Live fleet (`/dashboard`)**
- Signed-in managers get **Live fleet**, with a switch to **Demo data**. Everyone else sees the demo board with a sign-in prompt.
- `useLiveFleet` loads the org's technicians and today's sessions (with equipment, readings, steps and whispers), scoped by RLS. It refetches on Supabase Realtime changes and every 30 seconds as a fallback; the badge shows REALTIME or POLLING.
- `src/lib/live-fleet.ts` maps rows onto the same cards and inspector as the demo. A session sitting at step 3 or later without disconnect verification shows as **Safety gate hold**. Camera frames and the voice transcript aren't stored, so the inspector shows a session event log instead.

**Whispers**
- A manager's note is inserted into `manager_whispers` (RLS: only managers in the session's org).
- The tech's live session subscribes to its own whispers. It also catches up on any sent before it connected, and hands each one to Gemini as a `[SERVICE MANAGER]` turn. The coach relays it out loud, and the session stamps `delivered_at`, which the dashboard shows as "✓ delivered to headset".
- The system prompt says manager guidance never overrides the safety gate. Remote approve, clear-hold and dispatch buttons are demo-only.

Migration: `supabase/migrations/*_team_accounts_and_whispers.sql`.

**Vercel env for accounts:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, plus the server-only `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.

## OEM manual ingestion (RAG over `pgvector`)

This turns OEM service manuals (PDF) into searchable chunks in Supabase, so the coach can pull exact specs (charging charts, electrical data, fault codes, wiring notes) during a live call.

```bash
npm run oem:sample -- /tmp/sample.pdf                                   # synthetic test manual (fictional brand)
npm run oem:ingest -- /tmp/sample.pdf --manufacturer Apexair --model-prefix AXC --dry-run --out chunks.json
npm run oem:ingest -- ./manuals/carrier --manufacturer Carrier --model-prefix 24ACC6   # embed + store
npm run oem:search -- "target subcooling at 95 degrees" --manufacturer Carrier --model 24ACC636A003
```

`--dry-run` needs no keys. A real run needs `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and `GEMINI_API_KEY` (or `OPENAI_API_KEY` with `EMBEDDING_PROVIDER=openai`). Re-running on an unchanged file is skipped (matched by SHA-256) unless you pass `--force`.

**Pipeline** (`src/lib/rag/`)

| Stage | File | What it does |
|---|---|---|
| Extract | `pdf-extract.ts` | `pdfjs-dist` text items with coordinates and font size; rotated diagram labels skipped |
| Layout | `layout.ts` | Groups items into lines and cells. Strips running headers, footers and page numbers. Detects two-column pages and reads the left column then the right. Rebuilds tables from column-aligned rows, including wrapped cells. Stitches tables that cross a page break and drops the repeated header. Detects headings by font size or ALL CAPS. |
| Chunk | `chunker.ts` | Chunks never cross a heading. Tables are never split mid-row, and every piece of a long table repeats its header row plus caption. Prose splits at sentences with overlap (~450-token cap). Identical chunks, such as a repeated WARNING, are stored once. |
| Classify | `classify.ts` | `chunk_type` (`specifications`, `charging_chart`, `error_codes`, `wiring`, `troubleshooting`, `installation`, `maintenance`, `safety`, `general`), model numbers in each chunk, and brand detection |
| Embed | `embeddings.ts` | 1536-dim vectors. Gemini `gemini-embedding-001` (`text-embedding-004` is 768-dim only and can't fill `vector(1536)`) or OpenAI `text-embedding-3-small`. Batched, retries on 429/5xx, L2-normalized. The embedded text is prefixed with brand, document and section path; the stored `content` stays clean. |
| Store | `store.ts` | Upserts `oem_documents` by file hash, then inserts chunks under a new `ingest_run_id` and deletes the previous run only after every batch lands. A failed re-ingest leaves the old chunks serving. |
| Search | `search.ts` | `hybrid_search_oem_chunks` RPC (vector + full-text, reciprocal rank fusion), filtered by brand, the equipment's full model number (matched against `model_prefix`), chunk types and embedding model. `formatHitsForPrompt` gives citeable context. |

**Migration** `supabase/migrations/20261113014216_oem_vector_index.sql` (applied to the project) is additive on top of the existing `oem_knowledge_chunks` table and safe to re-run:
- Adds `oem_documents`, plus metadata columns on the chunks table and a generated `fts` column, with indexes.
- Creates the `match_oem_chunks` and `hybrid_search_oem_chunks` functions. They run with the caller's permissions, so RLS applies, and they turn on pgvector 0.8 iterative scans so filtered queries still return enough rows.
- Creates `idx_oem_chunks_hnsw` only if no cosine HNSW index exists. The project already has `idx_oem_embedding`, and a second HNSW index on the same column would double write cost for nothing.

**Live coach lookups.** The Live AI session has a sixth tool, `lookup_oem_spec { query, chunk_type? }`:
- **Scoped to the unit in code.** The browser (`src/lib/ai/oem-lookup-client.ts`) sends the query to `/api/live/lookup` with the brand and model of the equipment registered in the session. The model never chooses the brand. Before a data plate is registered the lookup is refused, so it can't quote another manufacturer's spec.
- **Short excerpts.** The route embeds the query, calls `hybrid_search_oem_chunks`, drops weak matches (no keyword hit and similarity below 0.45), and returns up to 4 excerpts of at most 1,200 characters, each with a "brand › document › section (page)" citation. Results are cached for 5 minutes per unit and query, and the route allows 60 requests per minute per IP.
- **Honest fallbacks.** When nothing matches, the library isn't configured, or the request fails, the coach is told to say so and to label anything it says as general field practice. A failed lookup is never a hard tool error.
- **On screen.** Each lookup appears in the HUD's "Manual lookups" card with its sources. Lookups are read-only and aren't saved.
- **Configuration.** The server needs `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and the same embedding provider used at ingestion: `GEMINI_API_KEY`, or `EMBEDDING_PROVIDER=openai` with `OPENAI_API_KEY`.

**Limits:** scanned PDFs (images, no text layer) need OCR first; the CLI lists pages with no text. Wiring diagrams contribute their text labels only, not the drawing. Token counts are estimated at about 4 characters per token.

## Fleet Command dashboard (`/dashboard`)

A service manager's view of 12 DFW technicians mid-shift. Everything is client-side mock data; no backend is involved.

- `src/lib/mock-fleet-data.ts` holds the 12 seeded techs (apprentices at 3–11 months, techs at 1–4 years; residential and light commercial jobs in Dallas, Plano, Irving, Mesquite, Garland and Arlington), with readings, transcripts and step findings. Times are seconds since the job started, so server and client render the same markup.
- `src/lib/fleet-sim.ts` is a pure reducer. `tick` runs every 4 s while **Simulate Live Updates** is on. Each tick advances job timers, jitters live gauges and moves a coaching tech one step every 24–40 s. A tech who reaches step 3 without disconnect verification drops into a simulated safety hold, which clears after they confirm 0V. Seeded escalations and holds wait for the manager.
- Manager actions are `whisper` (logged as `[MANAGER OVERRIDE]` and relayed by the AI coach), `clear` (approve an escalation, or clear a safety hold; holds need a second confirmation that the tech reported 0V) and `dispatch` (senior backup with an ETA, logged once per job).
- The KPI strip's first-time-fix rate and prevented truck rolls are seeded figures. Escalations and holds are counted live.
- Components live in `src/components/dashboard/`.

## Guided browser simulator (`/demo?mode=sim`)

A self-contained, in-browser simulation of a coached HVAC service call. It needs no API keys or hardware, and is the fallback for visitors without a camera or mic.

- `src/lib/demo-scenarios.ts`: the 3 scenarios (Carrier split AC / TXV, Trane heat pump / dual run cap, Lennox RTU / high static), each a typed 4-step diagnostic tree with OEM spec ranges, AI reasoning for in- and out-of-spec readings, root-cause confirmation logic, and the dispatch report builder.
- `src/components/demo/`: the simulator. `DemoSimulator.tsx` holds the state machine (select → scan → diagnose → complete). The other files are the scenario selector, data-plate scanner, equipment drawer, voice coach (Web Speech API), safety gate, telemetry controls and log, and the dispatch report.
- Readings are actually evaluated. If someone slides values back into spec, the AI's reasoning changes, and the final report says the root cause was **not** confirmed instead of guessing.
- To add a scenario, add a `Scenario` object to `SCENARIOS` and give it its own icon in `ScenarioSelector.tsx`.

## Brand tokens

Defined once in `globals.css` and used as Tailwind classes:

| Token | Hex | Class examples |
|---|---|---|
| slate-deep | #0B0F19 | `bg-slate-deep` |
| steel | #131A2A | `bg-steel` |
| line | #1E293B | `border-line` |
| amber | #F59E0B | `bg-amber`, `text-amber` |
| gauge | #EA580C | `from-gauge`, `bg-gauge` |
| emerald | #10B981 | `text-emerald` |
| ink / muted | #F8FAFC / #94A3B8 | `text-ink`, `text-muted` |

## ROI calculator assumptions

These are constants at the top of `RoiCalculator.tsx`:

- `CALLBACK_REDUCTION = 0.4`: 40% fewer callbacks and second-truck dispatches
- `SENIOR_HOURS_PER_WEEK = 6`: hours reclaimed per senior tech
- `JUNIORS_PER_SENIOR = 4`: used to work out how many senior techs the fleet has
- `GROWTH_FLEET_PRICE = 119`: the subscription cost the ROI multiple is measured against

## Before launch

- **Demo form:** `DemoModal.tsx` `onSubmit` currently simulates a submit. Point it at your CRM or a `/api/demo` route.
- **Live mode:** set `GEMINI_API_KEY` in the Vercel project's environment variables (server-side only), and add a stronger rate limit or sign-in for the token route.
- **Fonts:** fonts are fetched from Google at build time, so the build machine needs internet access (Vercel does).
