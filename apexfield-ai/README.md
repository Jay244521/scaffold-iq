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

For persistence, apply `supabase/migrations/20261112000000_live_service_sessions.sql` (`supabase db push` or the SQL editor). Without Supabase the live session still runs; tool calls are not saved.

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
