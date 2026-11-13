/**
 * Seed data for the Service Manager Fleet Command dashboard: 12 DFW technicians
 * mid-shift. Times are seconds since each job started (not wall-clock), so the
 * board renders identically on the server and the client.
 */

/** "ended" = live session stopped before a root cause was confirmed (live fleet only). */
export type TechStatus = "coaching" | "safety_hold" | "escalated" | "completed" | "ended";
export type StepStatus = "passed" | "failed" | "active" | "hold" | "upcoming";
/** "out" = out of spec with no direction recorded (live sessions store only within/out). */
export type ReadingStatus = "ok" | "low" | "high" | "out";
export type EquipmentKind = "split_ac" | "heat_pump" | "rtu" | "furnace";
export type Brand = "Carrier" | "Trane" | "Lennox" | "Daikin" | "York";

export type Equipment = {
  /** A seeded Brand in demo data; any manufacturer in live sessions. */
  brand: Brand | (string & {});
  model: string;
  kind: EquipmentKind;
  /** Refrigerant for cooling equipment, fuel for furnaces. */
  refrigerant: string;
  /** Display size, e.g. "3.0T" or "80K BTU". */
  size: string;
};

export type Reading = {
  id: string;
  label: string;
  /** Badge abbreviation, e.g. SUC, LIQ, SC. */
  short: string;
  value: number;
  unit: string;
  spec: string;
  status: ReadingStatus;
  atSec: number;
  /** Jitters slightly during auto-tick (live gauge). */
  live?: boolean;
};

export type TranscriptRole = "ai" | "tech" | "manager" | "system";
export type TranscriptLine = { id: string; role: TranscriptRole; text: string; atSec: number };

export type DiagnosticStep = { n: number; status: StepStatus; finding?: string };

export type Technician = {
  id: string;
  name: string;
  role: "Apprentice" | "Tech";
  experienceMonths: number;
  truck: string;
  city: string;
  customer: string;
  jobType: "Residential" | "Light Commercial";
  status: TechStatus;
  /** Why the tech is on hold / escalated, or the completion note. */
  statusReason?: string;
  equipment: Equipment;
  elapsedSec: number;
  currentStep: number;
  stepSummary: string;
  steps: DiagnosticStep[];
  readings: Reading[];
  transcript: TranscriptLine[];
  safetyVerified: boolean;
  backupDispatched: boolean;
  /** Simulation bookkeeping. */
  ticksOnStep: number;
  /** Present for real sessions from Supabase (live fleet mode). */
  live?: { sessionId: string; orgId: string; startedAt: string };
  /** Seeded holds wait for the manager; simulated ones resolve when the tech confirms 0V. */
  holdAutoResolves: boolean;
};

let idSeq = 0;
const rid = (p: string) => `${p}${(idSeq++).toString(36)}`;

function steps(current: number, at: StepStatus, findings: Record<number, string> = {}, failed: number[] = []): DiagnosticStep[] {
  return [1, 2, 3, 4, 5].map((n) => ({
    n,
    status: n < current ? (failed.includes(n) ? "failed" : "passed") : n === current ? at : "upcoming",
    finding: findings[n],
  }));
}
const done = (findings: Record<number, string> = {}, failed: number[] = []) =>
  [1, 2, 3, 4, 5].map((n) => ({ n, status: (failed.includes(n) ? "failed" : "passed") as StepStatus, finding: findings[n] }));

const r = (label: string, short: string, value: number, unit: string, spec: string, status: ReadingStatus, atSec: number, live = false): Reading => ({
  id: rid("r"),
  label,
  short,
  value,
  unit,
  spec,
  status,
  atSec,
  live,
});
const t = (role: TranscriptRole, text: string, atSec: number): TranscriptLine => ({ id: rid("t"), role, text, atSec });

type Seed = Omit<Technician, "backupDispatched" | "ticksOnStep" | "holdAutoResolves">;

const SEED: Seed[] = [
  {
    id: "t01",
    name: "Diego Ramirez",
    role: "Tech",
    experienceMonths: 48,
    truck: "TRUCK-01",
    city: "Plano",
    customer: "Hendricks Residence",
    jobType: "Residential",
    status: "coaching",
    equipment: { brand: "Carrier", model: "24ACC636A003", kind: "split_ac", refrigerant: "R-410A", size: "3.0T" },
    elapsedSec: 2_533,
    currentStep: 5,
    stepSummary: "Measuring subcooling at liquid service valve",
    steps: steps(5, "active", {
      1: "Carrier 24ACC636A003 registered · 3.0T · R-410A",
      2: "24.4V at contactor coil",
      3: "Disconnect pulled, 0V L1–L2 seen on camera",
      4: "Capacitor 44.6 µF (45 rated) · RLA within spec",
      5: "Subcooling reading low — checking TXV bulb",
    }),
    readings: [
      r("Control Voltage", "24V", 24.4, "V", "24V ±10%", "ok", 640),
      r("Capacitance (HERM-C)", "CAP", 44.6, "µF", "45 µF ±6%", "ok", 1_420),
      r("Suction", "SUC", 118, "PSI", "105–135 PSI", "ok", 2_210, true),
      r("Liquid", "LIQ", 342, "PSI", "290–420 PSI", "ok", 2_240, true),
      r("Subcooling", "SC", 4.2, "°F", "10°F ±3", "low", 2_470),
    ],
    transcript: [
      t("ai", "Gauges look connected. Read me suction and liquid once they settle.", 2_150),
      t("tech", "Suction one eighteen, liquid three forty-two.", 2_230),
      t("ai", "Both in range. Clamp the liquid line by the service valve and give me subcooling.", 2_260),
      t("tech", "Subcooling's showing four point two.", 2_460),
      t("ai", "That's 5.8°F under the 10°F target. Don't add refrigerant yet. Check the TXV sensing bulb strap on the suction line.", 2_480),
    ],
    safetyVerified: true,
  },
  {
    id: "t02",
    name: "Aaliyah Brooks",
    role: "Apprentice",
    experienceMonths: 4,
    truck: "TRUCK-02",
    city: "Mesquite",
    customer: "Ortiz Residence",
    jobType: "Residential",
    status: "safety_hold",
    statusReason: "Waiting on 240V disconnect confirmation before capacitor test",
    equipment: { brand: "Trane", model: "4TWR6036H1000A", kind: "heat_pump", refrigerant: "R-410A", size: "3.0T" },
    elapsedSec: 1_312,
    currentStep: 3,
    stepSummary: "Confirming 240V disconnect is pulled before touching the capacitor",
    steps: steps(3, "hold", {
      1: "Trane 4TWR6036H1000A registered · heat pump",
      2: "24.6V call present · compressor humming, not starting",
      3: "Disconnect not visible in frame",
    }),
    readings: [
      r("Control Voltage", "24V", 24.6, "V", "24V ±10%", "ok", 780),
      r("Line Voltage L1–L2", "LINE", 238, "V", "208–253V", "ok", 1_010, true),
    ],
    transcript: [
      t("tech", "Compressor's humming but the fan isn't spinning.", 900),
      t("ai", "Classic weak dual run capacitor symptom. We'll test it, but power comes off first.", 930),
      t("ai", "Stop. Pull the disconnect and show me your meter reading zero volts L1 to L2 before you touch the capacitor.", 1_180),
      t("tech", "Hang on, I can't find the disconnect, it's behind a bush.", 1_290),
    ],
    safetyVerified: false,
  },
  {
    id: "t03",
    name: "Kevin Tran",
    role: "Tech",
    experienceMonths: 26,
    truck: "TRUCK-03",
    city: "Irving",
    customer: "Las Colinas Dental · RTU-2",
    jobType: "Light Commercial",
    status: "escalated",
    statusReason: "Ambiguous static pressure: 0.92 in. w.c. TESP vs 0.50 rated, can't separate duct restriction from blower fault",
    equipment: { brand: "Lennox", model: "LGH060H4B", kind: "rtu", refrigerant: "R-410A", size: "5.0T" },
    elapsedSec: 3_890,
    currentStep: 5,
    stepSummary: "Evaluating high static pressure with low suction · iced evaporator",
    steps: steps(
      5,
      "failed",
      {
        1: "Lennox LGH060H4B registered · 5.0T RTU",
        2: "24.1V at unit control board",
        3: "Disconnect verified on camera",
        4: "Blower amps 6.8A (7.6 FLA) · capacitor OK",
        5: "TESP 0.92 in. w.c. — filters clean, cause unconfirmed",
      },
    ),
    readings: [
      r("Blower Amp Draw", "AMP", 6.8, "A", "≤ 7.6 FLA", "ok", 2_600),
      r("Suction", "SUC", 98, "PSI", "118–130 PSI", "low", 3_420, true),
      r("Total External Static", "TESP", 0.92, "in. w.c.", "0.50 in. w.c. rated", "high", 3_700),
      r("Superheat", "SH", 3.1, "°F", "8–12°F", "low", 3_760),
    ],
    transcript: [
      t("tech", "Filters are brand new. Static's still reading point nine two.", 3_700),
      t("ai", "That's nearly double the 0.50 rating. With clean filters this points to a closed damper, a collapsed flex run, or a blower speed tap problem.", 3_720),
      t("tech", "Dampers look open from here. Blower wheel looks clean.", 3_820),
      t("ai", "I can't confirm the cause from what I can see. Flagging this for your service manager before we condemn anything.", 3_860),
      t("system", "Escalated to service manager: ambiguous static pressure diagnosis.", 3_865),
    ],
    safetyVerified: true,
  },
  {
    id: "t04",
    name: "Jasmine Patel",
    role: "Apprentice",
    experienceMonths: 9,
    truck: "TRUCK-04",
    city: "Garland",
    customer: "Nguyen Residence",
    jobType: "Residential",
    status: "escalated",
    statusReason: "Anomalous compressor amp draw: 31.8A vs 21.2A RLA, possible hard start / locked rotor",
    equipment: { brand: "Daikin", model: "DX16SA0481", kind: "split_ac", refrigerant: "R-410A", size: "4.0T" },
    elapsedSec: 2_745,
    currentStep: 4,
    stepSummary: "Compressor amp draw 50% over RLA · capacitor weak",
    steps: steps(4, "failed", {
      1: "Daikin DX16SA0481 registered · 4.0T",
      2: "24.2V call at contactor",
      3: "0V verified verbally + on camera",
      4: "Compressor 31.8A vs 21.2 RLA · cap 34.1 µF (40 rated)",
    }),
    readings: [
      r("Control Voltage", "24V", 24.2, "V", "24V ±10%", "ok", 820),
      r("Capacitance (HERM-C)", "CAP", 34.1, "µF", "40 µF ±6%", "low", 2_210),
      r("Compressor Amp Draw", "AMP", 31.8, "A", "≤ 21.2 RLA", "high", 2_690, true),
    ],
    transcript: [
      t("tech", "Capacitor reads thirty-four point one on herm.", 2_210),
      t("ai", "Rated 40, so it's 15% low. That's a replace. Restore power and clamp the compressor common lead.", 2_240),
      t("tech", "Common's pulling almost thirty-two amps.", 2_690),
      t("ai", "That's 50% over the 21.2 RLA. Could be the weak cap or a compressor starting to lock up. Shut it down. I'm flagging this for review before you replace anything.", 2_710),
      t("system", "Escalated to service manager: anomalous compressor amp draw.", 2_715),
    ],
    safetyVerified: true,
  },
  {
    id: "t05",
    name: "Marcus Webb",
    role: "Tech",
    experienceMonths: 37,
    truck: "TRUCK-05",
    city: "Arlington",
    customer: "Arlington ISD · Admin Bldg",
    jobType: "Light Commercial",
    status: "coaching",
    equipment: { brand: "York", model: "ZF060C00A2A", kind: "rtu", refrigerant: "R-410A", size: "5.0T" },
    elapsedSec: 905,
    currentStep: 2,
    stepSummary: "Verifying 24V Y1 call at the RTU control board",
    steps: steps(2, "active", { 1: "York ZF060C00A2A registered · 5.0T RTU" }),
    readings: [r("Control Voltage", "24V", 23.9, "V", "24V ±10%", "ok", 880, true)],
    transcript: [
      t("ai", "Plate's registered. Put your meter on R and C at the control board, then Y1 to C with a call for cooling.", 760),
      t("tech", "R to C is twenty-three nine.", 880),
      t("ai", "Good transformer output. Now Y1 to C.", 895),
    ],
    safetyVerified: false,
  },
  {
    id: "t06",
    name: "Emily Carter",
    role: "Apprentice",
    experienceMonths: 3,
    truck: "TRUCK-06",
    city: "Dallas",
    customer: "Whitfield Residence · Lakewood",
    jobType: "Residential",
    status: "coaching",
    equipment: { brand: "Carrier", model: "59SC5A080E17", kind: "furnace", refrigerant: "Natural Gas", size: "80K BTU" },
    elapsedSec: 384,
    currentStep: 1,
    stepSummary: "Reading the furnace data plate in a dark attic",
    steps: steps(1, "active", { 1: "Plate partially readable — flashlight requested" }),
    readings: [],
    transcript: [
      t("ai", "I can see the plate but the model number is washed out. Turn on your phone flashlight and come in about six inches.", 330),
      t("tech", "Flashlight's on. Is that better?", 372),
      t("ai", "Much better. Hold steady for one second.", 380),
    ],
    safetyVerified: false,
  },
  {
    id: "t07",
    name: "Andre Jackson",
    role: "Tech",
    experienceMonths: 14,
    truck: "TRUCK-07",
    city: "Dallas",
    customer: "Bishop Arts Coffee Co.",
    jobType: "Light Commercial",
    status: "completed",
    statusReason: "Failed condenser fan motor replaced · head pressure restored",
    equipment: { brand: "Trane", model: "YSC060E3RHA", kind: "rtu", refrigerant: "R-410A", size: "5.0T" },
    elapsedSec: 4_980,
    currentStep: 5,
    stepSummary: "Job complete · dispatch report synced to ServiceTitan",
    steps: done({
      1: "Trane YSC060E3RHA registered",
      2: "24.3V at contactor",
      3: "Disconnect verified on camera",
      4: "Condenser fan motor open winding · replaced",
      5: "Head pressure 365 PSI after repair · SC 10°F",
    }),
    readings: [
      r("Condenser Fan Amps", "OFM", 0, "A", "1.9 A FLA", "low", 1_900),
      r("Liquid", "LIQ", 365, "PSI", "290–420 PSI", "ok", 4_620),
      r("Subcooling", "SC", 10.2, "°F", "10°F ±3", "ok", 4_700),
    ],
    transcript: [
      t("ai", "New motor's pulling 1.8 amps. Liquid 365 and subcooling 10.2. Both on target.", 4_710),
      t("ai", "Root cause confirmed: failed condenser fan motor. Dispatch report is ready.", 4_960),
      t("system", "Report synced to ServiceTitan job #88213.", 4_975),
    ],
    safetyVerified: true,
  },
  {
    id: "t08",
    name: "Sofia Hernandez",
    role: "Apprentice",
    experienceMonths: 11,
    truck: "TRUCK-08",
    city: "Plano",
    customer: "Patel Residence",
    jobType: "Residential",
    status: "coaching",
    equipment: { brand: "Lennox", model: "ML14XC1-036", kind: "split_ac", refrigerant: "R-410A", size: "3.0T" },
    elapsedSec: 1_870,
    currentStep: 4,
    stepSummary: "Testing dual run capacitor and compressor amp draw",
    steps: steps(4, "active", {
      1: "Lennox ML14XC1-036 registered",
      2: "24.5V at contactor coil",
      3: "0V L1–L2 verified on camera",
    }),
    readings: [
      r("Capacitance (HERM-C)", "CAP", 44.6, "µF", "45 µF ±6%", "ok", 1_640),
      r("Compressor Amp Draw", "AMP", 14.1, "A", "≤ 16.7 RLA", "ok", 1_830, true),
    ],
    transcript: [
      t("ai", "Herm side 44.6 on a 45 cap. That's good. Fan side next, C to FAN.", 1_650),
      t("tech", "Fan side four point nine.", 1_700),
      t("ai", "Good on the 5 µF side. Restore power and clamp compressor common.", 1_720),
      t("tech", "Fourteen point one amps.", 1_830),
    ],
    safetyVerified: true,
  },
  {
    id: "t09",
    name: "Tyler Nguyen",
    role: "Apprentice",
    experienceMonths: 6,
    truck: "TRUCK-09",
    city: "Irving",
    customer: "Morales Residence",
    jobType: "Residential",
    status: "safety_hold",
    statusReason: "Disconnect not visible in frame · waiting on verbal 0V confirmation",
    equipment: { brand: "York", model: "YCD36B21S", kind: "split_ac", refrigerant: "R-410A", size: "3.0T" },
    elapsedSec: 1_105,
    currentStep: 3,
    stepSummary: "Holding until 0V is confirmed at the contactor line side",
    steps: steps(3, "hold", { 1: "York YCD36B21S registered", 2: "24.0V at contactor coil" }),
    readings: [r("Control Voltage", "24V", 24.0, "V", "24V ±10%", "ok", 860)],
    transcript: [
      t("ai", "Before we look at the contactor, pull the disconnect and verify zero volts L1 to L2.", 1_010),
      t("tech", "Pulled it.", 1_060),
      t("ai", "I can't see the disconnect or your meter in the frame. Point the camera at the meter on L1 and L2 and say the reading.", 1_080),
    ],
    safetyVerified: false,
  },
  {
    id: "t10",
    name: "Brianna Lewis",
    role: "Tech",
    experienceMonths: 25,
    truck: "TRUCK-10",
    city: "Garland",
    customer: "Garland Family Medicine",
    jobType: "Light Commercial",
    status: "completed",
    statusReason: "Clogged condenser coil cleaned · head pressure back in spec",
    equipment: { brand: "Daikin", model: "DX17VSS601", kind: "split_ac", refrigerant: "R-410A", size: "5.0T" },
    elapsedSec: 3_410,
    currentStep: 5,
    stepSummary: "Job complete · dispatch report synced to ServiceTitan",
    steps: done(
      {
        1: "Daikin DX17VSS601 registered",
        2: "24.2V call",
        3: "Disconnect verified",
        4: "Compressor 19.8A (25.0 RLA)",
        5: "Liquid 468 → 385 PSI after coil cleaning",
      },
      [],
    ),
    readings: [
      r("Liquid (before)", "LIQ", 468, "PSI", "290–420 PSI", "high", 1_500),
      r("Liquid (after clean)", "LIQ", 385, "PSI", "290–420 PSI", "ok", 3_200),
      r("Subcooling", "SC", 11.4, "°F", "10°F ±3", "ok", 3_260),
    ],
    transcript: [
      t("ai", "Liquid dropped to 385 after the coil clean. Subcooling 11.4. You're done.", 3_270),
      t("system", "Report synced to ServiceTitan job #88197.", 3_400),
    ],
    safetyVerified: true,
  },
  {
    id: "t11",
    name: "Omar Siddiqui",
    role: "Tech",
    experienceMonths: 46,
    truck: "TRUCK-11",
    city: "Mesquite",
    customer: "Town East Retail · Suite 140",
    jobType: "Light Commercial",
    status: "coaching",
    equipment: { brand: "Carrier", model: "48FCEM08A2A6", kind: "rtu", refrigerant: "R-410A", size: "7.5T" },
    elapsedSec: 3_150,
    currentStep: 5,
    stepSummary: "Checking superheat on circuit B",
    steps: steps(5, "active", {
      1: "Carrier 48FCEM08A2A6 registered · 7.5T, 2 circuits",
      2: "24.2V Y1/Y2 calls present",
      3: "Disconnect verified on camera",
      4: "Both compressors within RLA",
      5: "Circuit A superheat 9.8°F",
    }),
    readings: [
      r("Superheat · Circuit A", "SH-A", 9.8, "°F", "8–12°F", "ok", 2_900),
      r("Suction · Circuit B", "SUC-B", 121, "PSI", "115–130 PSI", "ok", 3_080, true),
    ],
    transcript: [
      t("ai", "Circuit A is dialed in at 9.8 superheat. Move your clamp to the circuit B suction line.", 2_920),
      t("tech", "Suction B is one twenty-one.", 3_080),
      t("ai", "Good. Give it a minute to stabilize, then read me superheat.", 3_100),
    ],
    safetyVerified: true,
  },
  {
    id: "t12",
    name: "Hannah Kim",
    role: "Apprentice",
    experienceMonths: 8,
    truck: "TRUCK-12",
    city: "Arlington",
    customer: "Reyes Residence",
    jobType: "Residential",
    status: "coaching",
    equipment: { brand: "Trane", model: "4TTR4036L1000A", kind: "split_ac", refrigerant: "R-410A", size: "3.0T" },
    elapsedSec: 1_540,
    currentStep: 4,
    stepSummary: "Checking contactor contacts for pitting",
    steps: steps(4, "active", {
      1: "Trane 4TTR4036L1000A registered",
      2: "24.3V at contactor coil",
      3: "Tech confirmed 0V L1–L2 · meter on camera",
    }),
    readings: [r("Control Voltage", "24V", 24.3, "V", "24V ±10%", "ok", 700)],
    transcript: [
      t("tech", "Zero volts L1 to L2.", 1_380),
      t("ai", "I see it on your meter. Electrical's unlocked. Show me the contactor contacts up close.", 1_400),
      t("ai", "Slight pitting on L1. Measure resistance across the contacts with the coil pushed in.", 1_520),
    ],
    safetyVerified: true,
  },
];

export const FLEET_TOTAL_TRUCKS = 14;

export function createFleet(): Technician[] {
  return SEED.map((s) => ({
    ...s,
    backupDispatched: false,
    ticksOnStep: 0,
    holdAutoResolves: false,
    steps: s.steps.map((x) => ({ ...x })),
    readings: s.readings.map((x) => ({ ...x })),
    transcript: s.transcript.map((x) => ({ ...x })),
  }));
}

/** Senior techs available for second-truck backup. */
export const SENIOR_BACKUP = [
  { name: "Ray Delgado", truck: "TRUCK-S1", years: 14 },
  { name: "Lorraine Pitts", truck: "TRUCK-S2", years: 11 },
] as const;
