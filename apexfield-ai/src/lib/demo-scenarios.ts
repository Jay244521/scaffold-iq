/**
 * ApexField AI — interactive field demo data.
 * Every scenario is a 4-step diagnostic state machine. Step 2 is always the
 * hard safety gate. Readings are evaluated against the loaded OEM spec.
 */

export type ScenarioId = "A" | "B" | "C";

export type ReadingValues = Record<string, number>;

export type Metric = {
  id: string;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  decimals: number;
  /** The realistic field reading for this scenario (used by "Simulate Voice Reading"). */
  simulated: number;
  spec: { min?: number; max?: number };
  specLabel: string;
};

export type ReadingStep = {
  kind: "reading";
  id: string;
  title: string;
  instruction: string;
  vision: string[];
  metrics: Metric[];
  voiceChip: string;
  inSpec: (v: ReadingValues) => string;
  outOfSpec: (v: ReadingValues) => string;
};

export type SafetyStep = {
  kind: "safety";
  id: "safety-gate";
  title: string;
  instruction: string;
  vision: string[];
};

export type DiagnosticStep = ReadingStep | SafetyStep;

export type Equipment = {
  manufacturer: string;
  model: string;
  serial: string;
  refrigerant: string;
  tonnage: string;
  electrical: string;
  keySpec: { label: string; value: string };
  docs: string[];
  /** Lines printed on the simulated metal data plate. */
  plate: [string, string][];
};

export type Scenario = {
  id: ScenarioId;
  name: string;
  category: string;
  symptom: string;
  equipment: Equipment;
  steps: [ReadingStep, SafetyStep, ReadingStep, ReadingStep];
  /** True when the logged readings confirm the expected root cause. */
  confirm: (all: ReadingValues) => boolean;
  rootCause: { title: string; fix: string; parts: string[] };
  unconfirmed: { title: string; fix: string; parts: string[] };
};

export const SAFETY_GATE_TEXT =
  "Confirm service disconnect is pulled and verify 0V AC across L1/L2 before touching contactor or capacitor.";

const safetyGate: SafetyStep = {
  kind: "safety",
  id: "safety-gate",
  title: "Hard Safety Verification Gate",
  instruction: `Stop. ${SAFETY_GATE_TEXT} I won't release the next step until you confirm zero volts.`,
  vision: ["Service disconnect: checking position", "Meter: VAC, 600V scale", "Probes: L1 / L2 line side"],
};

export function fmt(value: number, decimals: number): string {
  return value.toFixed(decimals);
}

export function metricStatus(m: Metric, value: number): "within" | "out" {
  const okMin = m.spec.min === undefined || value >= m.spec.min;
  const okMax = m.spec.max === undefined || value <= m.spec.max;
  return okMin && okMax ? "within" : "out";
}

export function stepStatus(step: ReadingStep, values: ReadingValues): "within" | "out" {
  return step.metrics.some((m) => metricStatus(m, values[m.id] ?? m.simulated) === "out") ? "out" : "within";
}

/* ------------------------------------------------------------------ */
/* Scenario A — Residential split AC, low subcooling / TXV overfeed    */
/* ------------------------------------------------------------------ */

const scenarioA: Scenario = {
  id: "A",
  name: "Residential Split AC",
  category: "Low Subcooling / TXV Issue",
  symptom: "Unit running continuously, warm air blowing from supply vents.",
  equipment: {
    manufacturer: "Carrier",
    model: "24ACC636A003",
    serial: "2419E08712",
    refrigerant: "R-410A",
    tonnage: "3.0 Ton",
    electrical: "208/230V · 1PH · 60Hz",
    keySpec: { label: "Target Subcooling", value: "10.0°F" },
    docs: ["24ACC6 Service Manual", "TXV Subcooling Charging Chart", "Unit Wiring Diagram"],
    plate: [
      ["MODEL", "24ACC636A003"],
      ["SERIAL", "2419E08712"],
      ["REFRIG", "R-410A · FACTORY CHG"],
      ["VOLTS", "208/230 1PH 60HZ"],
      ["CAPACITY", "36,000 BTU/H · 3.0 TON"],
    ],
  },
  steps: [
    {
      kind: "reading",
      id: "baseline",
      title: "Refrigerant Circuit Baseline",
      instruction:
        "Gauges on. Let it run fifteen minutes to stabilize, then read suction pressure, liquid line pressure, and subcooling at the service valves.",
      vision: ["Manifold connected: suction + liquid ports", "Liquid line temp clamp detected", "Outdoor fan: RUNNING"],
      voiceChip: "Suction is 118 PSI, liquid is 342 PSI, subcooling is 4.2 degrees",
      metrics: [
        { id: "suction", label: "Suction", unit: "PSI", min: 60, max: 200, step: 1, decimals: 0, simulated: 118, spec: { min: 105, max: 135 }, specLabel: "105–135 PSI" },
        { id: "liquid", label: "Liquid", unit: "PSI", min: 200, max: 500, step: 1, decimals: 0, simulated: 342, spec: { min: 290, max: 420 }, specLabel: "290–420 PSI" },
        { id: "subcooling", label: "Subcooling", unit: "°F", min: 0, max: 25, step: 0.1, decimals: 1, simulated: 4.2, spec: { min: 7, max: 13 }, specLabel: "10.0°F ±3" },
      ],
      inSpec: () =>
        "Charge reads inside the OEM subcooling window. The refrigerant circuit baseline is good. Next we isolate the electrical side.",
      outOfSpec: (v) => {
        const sc = v.subcooling;
        if (sc < 7)
          return `Subcooling is ${fmt(10 - sc, 1)}°F below the 10°F target. Low subcooling with near-normal suction points to either low charge or a TXV overfeeding. Do not add refrigerant yet. We rule out electrical, then use superheat to split the two.`;
        if (sc > 13)
          return `Subcooling is ${fmt(sc - 10, 1)}°F over target. Liquid is stacking in the condenser, which points to a restriction or overcharge. Note it and we'll confirm with superheat.`;
        return "Pressures are outside the expected band for current conditions. Verify gauge hoses and ambient, then we'll keep isolating.";
      },
    },
    safetyGate,
    {
      kind: "reading",
      id: "capacitor",
      title: "Run Capacitor & Contactor Check",
      instruction:
        "Power is verified off. Safely discharge the run capacitor, set your meter to microfarads, and read HERM to C. Look over the contactor points while you're in there.",
      vision: ["Contactor points: no pitting detected", "Capacitor: no bulging or oil", "Disconnect: OPEN (verified)"],
      voiceChip: "Herm to C reads 44.6 microfarads",
      metrics: [
        { id: "cap", label: "Capacitor (HERM–C)", unit: "µF", min: 20, max: 60, step: 0.1, decimals: 1, simulated: 44.6, spec: { min: 42.3, max: 47.7 }, specLabel: "45 µF ±6%" },
      ],
      inSpec: (v) =>
        `Capacitor reads ${fmt(v.cap, 1)} µF, inside 45 µF ±6%. Contactor is clean. The start circuit isn't your problem. Restore power and let the system stabilize for superheat.`,
      outOfSpec: (v) =>
        `Capacitor reads ${fmt(v.cap, 1)} µF, outside 42.3 to 47.7. Flag it for replacement, but a weak cap doesn't explain low subcooling on its own. Restore power and check superheat.`,
    },
    {
      kind: "reading",
      id: "superheat",
      title: "Superheat at Evaporator Outlet",
      instruction:
        "Power's back on. Clamp the suction line at the evaporator outlet, right by the TXV sensing bulb, and read superheat.",
      vision: ["TXV sensing bulb: insulation missing", "Bulb strap: loose at 6 o'clock", "Suction line sweating back to compressor"],
      voiceChip: "Superheat is 2.1 degrees",
      metrics: [
        { id: "superheat", label: "Superheat", unit: "°F", min: 0, max: 30, step: 0.1, decimals: 1, simulated: 2.1, spec: { min: 8, max: 12 }, specLabel: "8–12°F (TXV)" },
      ],
      inSpec: (v) =>
        `Superheat is ${fmt(v.superheat, 1)}°F, right where a TXV should hold it. The valve is controlling. With low subcooling, that points back to charge. Run a leak search before adding refrigerant.`,
      outOfSpec: (v) =>
        v.superheat < 8
          ? `Superheat is ${fmt(v.superheat, 1)}°F. Combined with low subcooling, that's the TXV overfeeding. The bulb is loose and uninsulated, so it's reading ambient heat and driving the valve wide open. Liquid is flooding the evaporator and starving the condenser. This is a valve-control problem, not a charge problem.`
          : `Superheat is ${fmt(v.superheat, 1)}°F, high. High superheat with low subcooling is a classic undercharge. Leak search before you weigh in refrigerant.`,
    },
  ],
  confirm: (all) => all.subcooling < 7 && all.superheat < 8,
  rootCause: {
    title: "TXV overfeeding — sensing bulb loose & uninsulated",
    fix: "Clean the suction line, re-strap the TXV bulb at the 10 or 2 o'clock position, insulate bulb and line, let the system stabilize 15 minutes, then re-verify superheat 8–12°F and subcooling 10°F ±3. Do not add refrigerant. If superheat stays low after the bulb repair, replace the TXV.",
    parts: ["TXV bulb copper mounting straps (2)", "Closed-cell bulb insulation wrap", "Replacement TXV — only if superheat stays low after bulb repair"],
  },
  unconfirmed: {
    title: "TXV fault not confirmed by logged readings",
    fix: "Logged readings don't support a TXV overfeed. Re-verify pressures and line temps. If subcooling is low and superheat is high, run a leak search and weigh in charge to the OEM chart.",
    parts: ["Electronic leak detector check", "R-410A as needed after leak repair"],
  },
};

/* ------------------------------------------------------------------ */
/* Scenario B — Residential heat pump, failed dual run capacitor        */
/* ------------------------------------------------------------------ */

const scenarioB: Scenario = {
  id: "B",
  name: "Residential Heat Pump",
  category: "Failed Dual Run Capacitor",
  symptom: "Outdoor condenser humming loudly, compressor not starting, fan blade stationary.",
  equipment: {
    manufacturer: "Trane",
    model: "4TWR6036H1000A",
    serial: "23061N2X4F",
    refrigerant: "R-410A",
    tonnage: "3.0 Ton",
    electrical: "208/230V · 1PH · 60Hz",
    keySpec: { label: "Run Capacitor", value: "45/5 µF ±6%" },
    docs: ["4TWR6 Service Facts", "Heat Pump Wiring Diagram", "Capacitor & Motor Data"],
    plate: [
      ["MODEL", "4TWR6036H1000A"],
      ["SERIAL", "23061N2X4F"],
      ["REFRIG", "R-410A"],
      ["COMP", "RLA 13.5 · LRA 83.0"],
      ["CAP", "45/5 MFD 440 VAC"],
    ],
  },
  steps: [
    {
      kind: "reading",
      id: "startup",
      title: "Start Attempt — Amp Draw at Common",
      instruction:
        "Call for cooling. Clamp the compressor common wire and read amp draw on the start attempt. Don't let it sit locked more than a few seconds.",
      vision: ["Compressor: humming, not rotating", "Condenser fan blade: stationary", "Contactor: pulled in"],
      voiceChip: "Amp draw is 81.4 amps and it's not starting",
      metrics: [
        { id: "startAmps", label: "Amp Draw (Common)", unit: "A", min: 0, max: 100, step: 0.1, decimals: 1, simulated: 81.4, spec: { max: 13.5 }, specLabel: "≤ 13.5 A RLA" },
      ],
      inSpec: (v) =>
        `Running at ${fmt(v.startAmps, 1)} amps, inside RLA. The compressor started this time. An intermittent start still points to a weak cap. We'll test it.`,
      outOfSpec: (v) =>
        `Pulling ${fmt(v.startAmps, 1)} amps. That's locked-rotor territory against an LRA of 83. The contactor is closed, so voltage is reaching the compressor, and with the fan dead too, both motors share one suspect: the dual run capacitor. Kill power.`,
    },
    safetyGate,
    {
      kind: "reading",
      id: "capacitor",
      title: "Dual Run Capacitor Test",
      instruction:
        "Safely discharge the capacitor. Tag and pull the HERM, FAN, and C wires. Meter to microfarads. Read HERM to C, then FAN to C.",
      vision: ["Capacitor top: bulge detected", "Terminals: HERM / FAN / C identified", "Wires tagged"],
      voiceChip: "Herm to C reads 31.2 microfarads, fan to C reads 2.1",
      metrics: [
        { id: "herm", label: "HERM–C", unit: "µF", min: 0, max: 60, step: 0.1, decimals: 1, simulated: 31.2, spec: { min: 42.3, max: 47.7 }, specLabel: "45 µF ±6%" },
        { id: "fan", label: "FAN–C", unit: "µF", min: 0, max: 10, step: 0.1, decimals: 1, simulated: 2.1, spec: { min: 4.7, max: 5.3 }, specLabel: "5 µF ±6%" },
      ],
      inSpec: () =>
        "Both sections test inside 45/5 ±6%. The cap is good. Next suspects are an open compressor winding or a seized compressor. Check winding resistance before condemning anything.",
      outOfSpec: (v) => {
        const parts: string[] = [];
        if (v.herm < 42.3 || v.herm > 47.7) parts.push(`HERM is ${fmt(v.herm, 1)} µF against a 42.3 to 47.7 window`);
        if (v.fan < 4.7 || v.fan > 5.3) parts.push(`FAN is ${fmt(v.fan, 1)} µF against 4.7 to 5.3`);
        return `${parts.join(", and ")}. That's a failed dual run capacitor, and it explains both the hum and the stationary fan. Install a 45/5 µF, 440-volt replacement, then we verify.`;
      },
    },
    {
      kind: "reading",
      id: "verify",
      title: "Post-Repair Verification",
      instruction:
        "New 45/5 cap is wired HERM, FAN, and C. Restore power, call for cooling, and read running amps at common.",
      vision: ["Compressor: RUNNING", "Condenser fan: RUNNING", "Capacitor: new 45/5 µF 440V"],
      voiceChip: "Running amps are 12.8, fan is spinning",
      metrics: [
        { id: "runAmps", label: "Running Amps", unit: "A", min: 0, max: 40, step: 0.1, decimals: 1, simulated: 12.8, spec: { max: 13.5 }, specLabel: "≤ 13.5 A RLA" },
      ],
      inSpec: (v) =>
        `${fmt(v.runAmps, 1)} amps running, under the 13.5 amp RLA. Compressor and fan both started on the new cap. Repair confirmed.`,
      outOfSpec: (v) =>
        `Still drawing ${fmt(v.runAmps, 1)} amps, over RLA. It started, but it's working too hard. Check head pressure and condenser coil, and consider a hard-start kit if starts stay labored.`,
    },
  ],
  confirm: (all) => all.herm < 42.3 || all.herm > 47.7 || all.fan < 4.7 || all.fan > 5.3,
  rootCause: {
    title: "Failed dual run capacitor (45/5 µF)",
    fix: "Replace the dual run capacitor with a 45/5 µF ±6% unit rated 440 VAC (match or exceed the original voltage rating, never lower). Verify running amps under RLA and condenser fan rotation before leaving.",
    parts: ["45/5 µF ±6% dual run capacitor, 440 VAC, round", "Insulated female spade terminals (as needed)"],
  },
  unconfirmed: {
    title: "Capacitor tested good — compressor fault suspected",
    fix: "Capacitor is within spec. Check compressor winding resistance (C–S, C–R, S–R) and for a ground. If windings are open or grounded, escalate for compressor replacement quote.",
    parts: ["Winding resistance test", "Possible hard-start kit"],
  },
};

/* ------------------------------------------------------------------ */
/* Scenario C — Commercial RTU, high static / iced evaporator           */
/* ------------------------------------------------------------------ */

const scenarioC: Scenario = {
  id: "C",
  name: "Commercial Package RTU",
  category: "High Static Pressure / Iced Evaporator",
  symptom: "Suction line heavily iced over, low airflow across zone dampers.",
  equipment: {
    manufacturer: "Lennox",
    model: "LGH060H4B",
    serial: "5822L04631",
    refrigerant: "R-410A",
    tonnage: "5.0 Ton",
    electrical: "460V · 3PH · 60Hz",
    keySpec: { label: "Target Static", value: "0.50 in. w.c." },
    docs: ["LGH Series Service Manual", "Blower Performance Table", "Unit Wiring Diagram"],
    plate: [
      ["MODEL", "LGH060H4B"],
      ["SERIAL", "5822L04631"],
      ["REFRIG", "R-410A"],
      ["VOLTS", "460 3PH 60HZ"],
      ["NOMINAL", "5.0 TON · 0.50 IN. W.C. ESP"],
    ],
  },
  steps: [
    {
      kind: "reading",
      id: "static",
      title: "Total External Static Pressure",
      instruction:
        "Manometer on. Read supply and return static at the unit and add them for total external static.",
      vision: ["Supply / return probes placed", "Suction line: heavy frost to compressor", "Zone dampers: low airflow"],
      voiceChip: "Total external static is 1.10 inches",
      metrics: [
        { id: "static", label: "Total External Static", unit: "in. w.c.", min: 0.1, max: 2, step: 0.01, decimals: 2, simulated: 1.1, spec: { max: 0.55 }, specLabel: "0.50 in. w.c. target" },
      ],
      inSpec: (v) =>
        `Static is ${fmt(v.static, 2)}, close to the 0.50 design. Airflow isn't the restriction. Ice with normal static points at low charge or a metering problem.`,
      outOfSpec: (v) =>
        `Total static is ${fmt(v.static, 2)} inches, ${fmt(v.static / 0.5, 1)} times design. The blower can't move rated air through that restriction. Less air across the coil drops it below 32°F and it ices. Find the restriction before touching refrigerant.`,
    },
    safetyGate,
    {
      kind: "reading",
      id: "filters",
      title: "Filter Bank & Coil Inspection",
      instruction:
        "Power is verified off. Open the filter access, read pressure drop across the filter bank, and look at the evaporator face and blower wheel.",
      vision: ["Filters: heavily loaded, bowed", "Evaporator face: ice on lower 60%", "Blower wheel: light debris"],
      voiceChip: "Filter pressure drop is 0.62 inches",
      metrics: [
        { id: "filterDrop", label: "Filter Pressure Drop", unit: "in. w.c.", min: 0, max: 1.2, step: 0.01, decimals: 2, simulated: 0.62, spec: { max: 0.25 }, specLabel: "≤ 0.25 in. w.c." },
      ],
      inSpec: (v) =>
        `Filters drop only ${fmt(v.filterDrop, 2)}. They're not the restriction. Check for closed dampers, a slipping belt, or a dirty blower wheel.`,
      outOfSpec: (v) =>
        `Filters are dropping ${fmt(v.filterDrop, 2)} inches, more than double the change-out point. That's most of your excess static. Replace them, and let the coil thaw completely before restart. Never chip ice off the fins.`,
    },
    {
      kind: "reading",
      id: "verify",
      title: "Restart & Airflow Verification",
      instruction:
        "New filters in, coil fully thawed. Restore power, run cooling ten minutes, and read total static and suction pressure.",
      vision: ["Evaporator: clear, no frost", "Filters: new", "Zone dampers: airflow restored"],
      voiceChip: "Static is 0.48 inches, suction is 118 PSI",
      metrics: [
        { id: "staticAfter", label: "Total Static", unit: "in. w.c.", min: 0.1, max: 2, step: 0.01, decimals: 2, simulated: 0.48, spec: { max: 0.55 }, specLabel: "0.50 in. w.c. target" },
        { id: "suctionAfter", label: "Suction", unit: "PSI", min: 60, max: 180, step: 1, decimals: 0, simulated: 118, spec: { min: 105, max: 135 }, specLabel: "105–135 PSI" },
      ],
      inSpec: (v) =>
        `Static is back to ${fmt(v.staticAfter, 2)} and suction is holding at ${fmt(v.suctionAfter, 0)} PSI, roughly 40°F saturation and safely above freezing. Airflow is restored and the ice won't come back.`,
      outOfSpec: (v) =>
        v.staticAfter > 0.55
          ? `Static is still ${fmt(v.staticAfter, 2)} with new filters. Check for closed zone dampers, a dirty blower wheel, or an undersized return.`
          : `Static is good, but suction at ${fmt(v.suctionAfter, 0)} PSI is out of range. Check charge against the OEM chart before you leave.`,
    },
  ],
  confirm: (all) => all.static > 0.55 && all.filterDrop > 0.25,
  rootCause: {
    title: "Clogged filter bank → high static → iced evaporator",
    fix: "Replace the full filter bank, thaw the coil completely (never chip ice), clean the blower wheel, and verify total static ≤ 0.50 in. w.c. with suction above ~102 PSI (32°F saturation). Put the RTU on a quarterly filter PM.",
    parts: ["Full replacement filter set (size per unit filter rack label)", "Non-acid evaporator coil cleaner", "Quarterly filter PM tag"],
  },
  unconfirmed: {
    title: "Airflow restriction not confirmed",
    fix: "Static and filter readings don't explain the ice. Check refrigerant charge against the OEM chart, inspect the metering device, and verify blower speed tap and belt tension.",
    parts: ["Charge verification", "Blower belt (if worn)"],
  },
};

export const SCENARIOS: Scenario[] = [scenarioA, scenarioB, scenarioC];

export function getScenario(id: ScenarioId): Scenario {
  const s = SCENARIOS.find((x) => x.id === id);
  if (!s) throw new Error(`Unknown scenario ${id}`);
  return s;
}

/* ------------------------------------------------------------------ */
/* Logs & report                                                       */
/* ------------------------------------------------------------------ */

export type LoggedReading = {
  metricId: string;
  label: string;
  value: number;
  display: string;
  unit: string;
  specLabel: string;
  status: "within" | "out";
};

export type LogEntry =
  | {
      type: "reading";
      stepIndex: number;
      stepTitle: string;
      time: string;
      source: "voice" | "manual";
      spoken?: string;
      readings: LoggedReading[];
      status: "within" | "out";
      reasoning: string;
    }
  | {
      type: "safety";
      stepIndex: number;
      stepTitle: string;
      time: string;
      status: "verified";
      reasoning: string;
    };

export function buildReading(step: ReadingStep, values: ReadingValues): LoggedReading[] {
  return step.metrics.map((m) => {
    const value = values[m.id] ?? m.simulated;
    return {
      metricId: m.id,
      label: m.label,
      value,
      display: fmt(value, m.decimals),
      unit: m.unit,
      specLabel: m.specLabel,
      status: metricStatus(m, value),
    };
  });
}

export function collectValues(logs: LogEntry[]): ReadingValues {
  const out: ReadingValues = {};
  for (const l of logs) {
    if (l.type === "reading") for (const r of l.readings) out[r.metricId] = r.value;
  }
  return out;
}

export function buildReportText(args: {
  scenario: Scenario;
  logs: LogEntry[];
  safetyTime: string | null;
  confirmed: boolean;
  generatedAt: string;
}): string {
  const { scenario, logs, safetyTime, confirmed, generatedAt } = args;
  const e = scenario.equipment;
  const rc = confirmed ? scenario.rootCause : scenario.unconfirmed;
  const lines: string[] = [];
  lines.push("APEXFIELD AI — DISPATCH SUMMARY");
  lines.push(`Generated: ${generatedAt}`);
  lines.push("");
  lines.push("EQUIPMENT");
  lines.push(`${e.manufacturer} ${e.model} | S/N ${e.serial}`);
  lines.push(`${e.tonnage} | ${e.refrigerant} | ${e.electrical}`);
  lines.push(`${e.keySpec.label}: ${e.keySpec.value}`);
  lines.push("");
  lines.push("REPORTED SYMPTOM");
  lines.push(scenario.symptom);
  lines.push("");
  lines.push("SAFETY VERIFICATION");
  lines.push(`Disconnect pulled & 0V AC verified L1/L2 at ${safetyTime ?? "—"}`);
  lines.push("");
  lines.push("TELEMETRY LOG");
  for (const l of logs) {
    if (l.type !== "reading") continue;
    lines.push(`[${l.time}] ${l.stepTitle}`);
    for (const r of l.readings) {
      lines.push(`  - ${r.label}: ${r.display} ${r.unit} (spec ${r.specLabel}) — ${r.status === "within" ? "WITHIN SPEC" : "OUT OF SPEC"}`);
    }
  }
  lines.push("");
  lines.push(confirmed ? "CONFIRMED ROOT CAUSE" : "FINDING");
  lines.push(rc.title);
  lines.push(rc.fix);
  lines.push("");
  lines.push("RECOMMENDED PARTS");
  for (const p of rc.parts) lines.push(`  - ${p}`);
  return lines.join("\n");
}
