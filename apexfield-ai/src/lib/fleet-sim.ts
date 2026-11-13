/**
 * Pure state machine behind the fleet dashboard: auto-tick simulation plus the
 * service manager's interventions. Randomness comes from a PRNG seeded by the
 * tick number, so the reducer stays deterministic and testable.
 */
import { SAFETY_STEP } from "./diagnostic-sequence";
import { SENIOR_BACKUP, createFleet, type Reading, type Technician, type TranscriptLine } from "./mock-fleet-data";

export const TICK_MS = 4_000;
const TICK_SEC = TICK_MS / 1000;
/** A tech confirms 0V on a simulated hold after this many ticks. */
const HOLD_RESOLVE_TICKS = 3;

export const STEP_SUMMARY: Record<number, string> = {
  1: "Reading the OEM data plate",
  2: "Verifying 24V control signal at the contactor coil",
  3: "Confirming 240V disconnect is pulled and 0V measured",
  4: "Testing contactor, capacitor and amp draw",
  5: "Measuring superheat and subcooling against the OEM chart",
};

export type DispatchRecord = { id: string; techId: string; senior: string; seniorTruck: string; etaMin: number };

export type FleetState = { techs: Technician[]; tick: number; dispatches: DispatchRecord[]; seq: number };

export type FleetAction =
  | { type: "tick" }
  | { type: "whisper"; id: string; text: string }
  | { type: "clear"; id: string }
  | { type: "dispatch"; id: string };

export function initialFleetState(): FleetState {
  return { techs: createFleet(), tick: 0, dispatches: [], seq: 0 };
}

/* ------------------------------ helpers ------------------------------ */

function prng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let x = a;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

const firstName = (t: Technician) => t.name.split(" ")[0];
const round = (v: number, dp: number) => Math.round(v * 10 ** dp) / 10 ** dp;
/** 6–10 ticks (24–40 s) per step, stable per tech, so the board moves without racing to "all complete". */
const stepTicks = (t: Technician) => 6 + (t.id.charCodeAt(t.id.length - 1) % 5);

function line(state: FleetState, role: TranscriptLine["role"], text: string, atSec: number): TranscriptLine {
  state.seq++;
  return { id: `s${state.seq}`, role, text, atSec };
}

function reading(state: FleetState, r: Omit<Reading, "id">): Reading {
  state.seq++;
  return { ...r, id: `sr${state.seq}` };
}

function jitter(r: Reading, rand: () => number): Reading {
  if (!r.live) return r;
  const span = r.unit === "PSI" ? 2 : r.unit === "A" ? 0.4 : r.unit === "V" ? 0.4 : 0;
  if (!span) return r;
  const dp = r.unit === "PSI" ? 0 : 1;
  return { ...r, value: round(r.value + (rand() - 0.5) * span, dp) };
}

/* ------------------------------ simulation ------------------------------ */

function advance(state: FleetState, t: Technician, rand: () => number): Technician {
  const s = t.currentStep;
  const at = t.elapsedSec;

  if (s === SAFETY_STEP && !t.safetyVerified) {
    return {
      ...t,
      status: "safety_hold",
      statusReason: "Waiting on 240V disconnect confirmation",
      stepSummary: STEP_SUMMARY[3],
      steps: t.steps.map((x) => (x.n === 3 ? { ...x, status: "hold" } : x)),
      ticksOnStep: 0,
      holdAutoResolves: true,
      transcript: [
        ...t.transcript,
        line(state, "ai", "Stop. Pull the disconnect and show me zero volts L1 to L2 before you touch the contactor or capacitor.", at),
      ],
    };
  }

  const cooling = t.equipment.kind !== "furnace";
  const newReadings: Reading[] = [];
  let finding = "";
  let say = "";

  if (s === 1) {
    finding = `${t.equipment.brand} ${t.equipment.model} registered`;
    say = `Got it: ${t.equipment.brand} ${t.equipment.model}. Next, check for 24 volts at the contactor coil.`;
  } else if (s === 2) {
    const v = round(23.8 + rand() * 0.9, 1);
    newReadings.push(reading(state, { label: "Control Voltage", short: "24V", value: v, unit: "V", spec: "24V ±10%", status: "ok", atSec: at }));
    finding = `${v}V at contactor coil`;
    say = `${v} volts. Control circuit is good.`;
  } else if (s === 4) {
    if (cooling) {
      const a = round(12.5 + rand() * 4, 1);
      newReadings.push(reading(state, { label: "Compressor Amp Draw", short: "AMP", value: a, unit: "A", spec: "≤ RLA on plate", status: "ok", atSec: at, live: true }));
      finding = `Compressor ${a}A · capacitor within ±6%`;
      say = `${a} amps, under RLA. Electrical checks out. Let's look at the refrigerant side.`;
    } else {
      const a = round(3 + rand(), 1);
      newReadings.push(reading(state, { label: "Igniter Amps", short: "IGN", value: a, unit: "A", spec: "2.5–5.0 A", status: "ok", atSec: at }));
      finding = `Igniter ${a}A · inducer proving`;
      say = `Igniter's pulling ${a} amps. Good. Now check temperature rise.`;
    }
  } else if (s === 5) {
    if (cooling) {
      const sh = round(8.6 + rand() * 3, 1);
      const sc = round(8.5 + rand() * 3, 1);
      newReadings.push(
        reading(state, { label: "Superheat", short: "SH", value: sh, unit: "°F", spec: "8–12°F", status: "ok", atSec: at }),
        reading(state, { label: "Subcooling", short: "SC", value: sc, unit: "°F", spec: "10°F ±3", status: "ok", atSec: at }),
      );
      finding = `SH ${sh}°F · SC ${sc}°F, on chart`;
      say = `Superheat ${sh}, subcooling ${sc}. Both on the chart. Root cause confirmed, so I'm writing up the dispatch report.`;
    } else {
      const rise = Math.round(42 + rand() * 14);
      newReadings.push(reading(state, { label: "Temperature Rise", short: "RISE", value: rise, unit: "°F", spec: "35–65°F", status: "ok", atSec: at }));
      finding = `Temp rise ${rise}°F, within plate range`;
      say = `${rise} degree rise, within plate range. Root cause confirmed, so I'm writing up the dispatch report.`;
    }
  }

  const steps = t.steps.map((x) => {
    if (x.n === s) return { ...x, status: x.status === "failed" ? x.status : ("passed" as const), finding: x.finding ?? finding };
    if (x.n === s + 1) return { ...x, status: "active" as const };
    return x;
  });
  const transcript = say ? [...t.transcript, line(state, "ai", say, at)] : t.transcript;
  const readings = [...t.readings, ...newReadings];

  if (s >= 5) {
    return {
      ...t,
      steps,
      readings,
      status: "completed",
      statusReason: "Root cause confirmed · report synced to ServiceTitan",
      stepSummary: "Job complete · dispatch report synced to ServiceTitan",
      transcript: [...transcript, line(state, "system", "Dispatch report synced to ServiceTitan.", at)],
      ticksOnStep: 0,
    };
  }
  return { ...t, steps, readings, transcript, currentStep: s + 1, stepSummary: STEP_SUMMARY[s + 1], ticksOnStep: 0 };
}

function resolveSafety(state: FleetState, t: Technician, how: "tech" | "manager"): Technician {
  const at = t.elapsedSec;
  const lines =
    how === "tech"
      ? [
          line(state, "tech", "Disconnect's pulled. Zero volts L1 to L2.", at),
          line(state, "ai", "I see 0.0 on your meter. Electrical steps are unlocked.", at),
        ]
      : [
          line(state, "manager", "Tech confirmed disconnect pulled and 0V L1–L2 over radio. Clearing the safety hold.", at),
          line(state, "ai", "Manager cleared the hold on radio confirmation. Electrical steps unlocked. Keep the disconnect pulled until I say so.", at),
        ];
  return {
    ...t,
    status: "coaching",
    statusReason: undefined,
    safetyVerified: true,
    currentStep: Math.max(t.currentStep, 4),
    stepSummary: STEP_SUMMARY[4],
    steps: t.steps.map((x) =>
      x.n === 3
        ? { ...x, status: "passed", finding: how === "tech" ? "0V L1–L2 verified on camera" : "0V confirmed over radio · cleared by service manager" }
        : x.n === 4 && x.status === "upcoming"
          ? { ...x, status: "active" }
          : x,
    ),
    ticksOnStep: 0,
    holdAutoResolves: false,
    transcript: [...t.transcript, ...lines],
  };
}

function tickTech(state: FleetState, t: Technician, i: number): Technician {
  if (t.status === "completed") return t;
  const rand = prng(state.tick * 7919 + i * 104729);
  let next: Technician = { ...t, elapsedSec: t.elapsedSec + TICK_SEC, readings: t.readings.map((r) => jitter(r, rand)) };

  if (next.status === "safety_hold" && next.holdAutoResolves) {
    next = { ...next, ticksOnStep: next.ticksOnStep + 1 };
    if (next.ticksOnStep >= HOLD_RESOLVE_TICKS) next = resolveSafety(state, next, "tech");
  } else if (next.status === "coaching") {
    next = { ...next, ticksOnStep: next.ticksOnStep + 1 };
    if (next.ticksOnStep >= stepTicks(next)) next = advance(state, next, rand);
  }
  // Escalations and seeded holds wait for the service manager.
  return next;
}

/* ------------------------------ reducer ------------------------------ */

export function fleetReducer(prev: FleetState, action: FleetAction): FleetState {
  const state: FleetState = { ...prev, tick: prev.tick + (action.type === "tick" ? 1 : 0) };
  const update = (id: string, fn: (t: Technician) => Technician) => {
    state.techs = prev.techs.map((t) => (t.id === id ? fn(t) : t));
    return state;
  };

  switch (action.type) {
    case "tick":
      state.techs = prev.techs.map((t, i) => tickTech(state, t, i));
      return state;

    case "whisper": {
      const text = action.text.trim().slice(0, 500);
      if (!text) return prev;
      return update(action.id, (t) =>
        t.status === "completed"
          ? t
          : {
              ...t,
              transcript: [
                ...t.transcript,
                line(state, "manager", text, t.elapsedSec),
                line(state, "ai", `Copy. Relaying your guidance to ${firstName(t)}'s headset now.`, t.elapsedSec),
              ],
            },
      );
    }

    case "clear":
      return update(action.id, (t) => {
        if (t.status === "safety_hold") return resolveSafety(state, t, "manager");
        if (t.status !== "escalated") return t;
        return {
          ...t,
          status: "coaching",
          statusReason: undefined,
          ticksOnStep: 0,
          transcript: [
            ...t.transcript,
            line(state, "manager", "Escalation reviewed. Approved to proceed with the recommended repair.", t.elapsedSec),
            line(state, "ai", "Service manager approved. Continuing the diagnostic.", t.elapsedSec),
          ],
        };
      });

    case "dispatch": {
      const tech = prev.techs.find((t) => t.id === action.id);
      if (!tech || tech.backupDispatched || tech.status === "completed") return prev;
      const senior = SENIOR_BACKUP[prev.dispatches.length % SENIOR_BACKUP.length];
      const etaMin = 14 + ((prev.dispatches.length * 7 + tech.id.charCodeAt(2)) % 16);
      state.seq++;
      state.dispatches = [...prev.dispatches, { id: `d${state.seq}`, techId: tech.id, senior: senior.name, seniorTruck: senior.truck, etaMin }];
      return update(action.id, (t) => ({
        ...t,
        backupDispatched: true,
        transcript: [
          ...t.transcript,
          line(state, "system", `Senior tech backup dispatched: ${senior.name} (${senior.truck}), ETA ${etaMin} min.`, t.elapsedSec),
        ],
      }));
    }
  }
}

/* ------------------------------ selectors ------------------------------ */

export type FleetFilter = "all" | "attention" | "apprentices" | "in_progress" | "completed";

export const needsAttention = (t: Technician) => t.status === "escalated" || t.status === "safety_hold";

const FILTERS: Record<FleetFilter, (t: Technician) => boolean> = {
  all: () => true,
  attention: needsAttention,
  apprentices: (t) => t.role === "Apprentice" && t.experienceMonths < 12,
  in_progress: (t) => t.status !== "completed",
  completed: (t) => t.status === "completed",
};

export function filterCounts(techs: Technician[]): Record<FleetFilter, number> {
  return Object.fromEntries(
    (Object.keys(FILTERS) as FleetFilter[]).map((k) => [k, techs.filter(FILTERS[k]).length]),
  ) as Record<FleetFilter, number>;
}

const STATUS_ORDER: Record<Technician["status"], number> = { escalated: 0, safety_hold: 1, coaching: 2, completed: 3 };

export function selectTechs(techs: Technician[], filter: FleetFilter, query: string): Technician[] {
  const q = query.trim().toLowerCase();
  return techs
    .filter(FILTERS[filter])
    .filter(
      (t) =>
        !q ||
        [t.name, t.truck, t.customer, t.city, t.equipment.brand, t.equipment.model].some((f) => f.toLowerCase().includes(q)),
    )
    .map((t, i) => ({ t, i }))
    .sort((a, b) => STATUS_ORDER[a.t.status] - STATUS_ORDER[b.t.status] || a.i - b.i)
    .map(({ t }) => t);
}
