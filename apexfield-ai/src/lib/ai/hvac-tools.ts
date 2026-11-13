/**
 * Gemini Live API configuration for the ApexField master-tech coach:
 * the system instruction, the five deterministic HVAC function declarations,
 * and strict runtime validators for the arguments the model sends back.
 *
 * Shared by the server (ephemeral token constraints, persistence route) and
 * the browser (live session hook), so both sides agree on one schema.
 */
import { Modality, Type, type FunctionDeclaration, type LiveConnectConfig } from "@google/genai";

/** Default Live model. Override with GEMINI_LIVE_MODEL on the server. */
export const DEFAULT_LIVE_MODEL = "gemini-2.5-flash-native-audio-preview-09-2025";

import { DIAGNOSTIC_SEQUENCE } from "../diagnostic-sequence";
export { DIAGNOSTIC_SEQUENCE, SAFETY_STEP } from "../diagnostic-sequence";

export const HVAC_SYSTEM_INSTRUCTION = `You are ApexField, an expert master HVAC technician coaching a junior technician on a live service call. You see the technician's rear phone camera at about one frame per second and hear them through their earbuds.

How you speak:
- Be concise and direct. Keep every spoken response to 2-3 short sentences so the technician can work hands-free.
- Give one instruction at a time. Use plain field language and real units (PSI, °F, µF, amps, volts, in. w.c.).

Strict diagnostic sequence. Do not skip ahead:
1. Identify the equipment data plate. When a data plate is readable in the camera, call register_equipment_plate with exactly what is printed. Never invent a model or serial number.
2. Verify the 24V control signal at the thermostat call / contactor coil.
3. Enforce high-voltage disconnect verification BEFORE the technician touches any contactor, capacitor, or line-voltage wiring. Call verify_safety_disconnect only when you clearly SEE the service disconnect pulled (visual_frame) or HEAR the technician explicitly confirm the disconnect is pulled and 0V is measured (verbal_confirmation).
4. Test the contactor, capacitor (µF against the rated value), and amp draw against RLA/FLA on the plate.
5. Evaluate refrigerant pressures, superheat, and subcooling against the OEM spec for this unit.

Tools:
- Call log_diagnostic_reading every time the technician speaks a reading or you can clearly read a gauge or meter in the frame. Judge is_within_spec against the OEM spec for the registered unit and explain the target in target_spec_note.
- Call advance_diagnostic_step whenever a check passes or fails and the diagnostic tree moves. step_number follows the 5-step sequence above.
- Call complete_service_session only once the root cause is confirmed by readings, not suspected.
- If a tool returns an error, follow it. Tool errors are hard safety and sequencing rules enforced by the system; never argue with them or work around them.

Safety rules you never break:
- Never guess electrical wiring, terminal designations, or wire colors. If you cannot see it clearly, say so.
- Never tell the technician to bypass, jump, or defeat a safety disconnect, pressure switch, or limit.
- If a reading, gauge, or frame is unclear, ask the technician to move the camera closer, hold steady, or turn on the phone flashlight. Do not guess.`;

const READING_TYPES = [
  "suction_psi",
  "liquid_psi",
  "superheat",
  "subcooling",
  "amp_draw",
  "voltage",
  "static_pressure",
  "capacitance_uf",
] as const;
export type ReadingType = (typeof READING_TYPES)[number];

/** Readings that require the high-voltage disconnect to be verified first (power must be off). */
export const DE_ENERGIZED_READINGS: readonly ReadingType[] = ["capacitance_uf"];

const VERIFICATION_METHODS = ["visual_frame", "verbal_confirmation"] as const;
const STEP_STATUSES = ["passed", "failed", "in_progress"] as const;

export const HVAC_FUNCTION_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: "register_equipment_plate",
    description:
      "Register the HVAC unit from its OEM data plate once the plate is clearly readable in the camera. Use only values printed on the plate.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        manufacturer: { type: Type.STRING, description: "Brand on the plate, e.g. Carrier, Trane, Lennox." },
        model_number: { type: Type.STRING, description: "Model number exactly as printed." },
        serial_number: { type: Type.STRING, description: "Serial number exactly as printed, if readable." },
        equipment_type: {
          type: Type.STRING,
          description: "e.g. split AC condenser, heat pump, air handler, gas furnace, packaged RTU.",
        },
        refrigerant_type: { type: Type.STRING, description: "e.g. R-410A, R-454B, R-32, R-22." },
        tonnage: { type: Type.NUMBER, description: "Nominal tons, derived from the model number or plate." },
      },
      required: ["manufacturer", "model_number", "equipment_type"],
    },
  },
  {
    name: "verify_safety_disconnect",
    description:
      "Record high-voltage disconnect verification. Call ONLY when you clearly see the service disconnect pulled in the frame, or hear the technician explicitly confirm it is pulled and 0V measured.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        verified: { type: Type.BOOLEAN, description: "true only when the disconnect is confirmed pulled / 0V." },
        verification_method: { type: Type.STRING, enum: [...VERIFICATION_METHODS], format: "enum" },
        notes: { type: Type.STRING, description: "What you saw or heard, e.g. 'Pull-out removed, 0V L1-L2 on meter'." },
      },
      required: ["verified", "verification_method", "notes"],
    },
  },
  {
    name: "log_diagnostic_reading",
    description: "Log a gauge or meter reading the technician spoke or showed on camera, judged against OEM spec.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        reading_type: { type: Type.STRING, enum: [...READING_TYPES], format: "enum" },
        numeric_value: { type: Type.NUMBER },
        unit: { type: Type.STRING, description: "PSI, °F, A, V, in. w.c., or µF." },
        is_within_spec: { type: Type.BOOLEAN },
        target_spec_note: {
          type: Type.STRING,
          description: "The OEM target this was judged against, e.g. 'Subcooling 10°F ±3 per Carrier chart'.",
        },
      },
      required: ["reading_type", "numeric_value", "unit", "is_within_spec", "target_spec_note"],
    },
  },
  {
    name: "advance_diagnostic_step",
    description: "Move the diagnostic tree: mark a step passed or failed, or start the next step.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        step_number: { type: Type.INTEGER, description: "1-5 per the diagnostic sequence." },
        instruction: { type: Type.STRING, description: "Short instruction shown to the technician for this step." },
        expected_target: { type: Type.STRING, description: "What a good result looks like." },
        status: { type: Type.STRING, enum: [...STEP_STATUSES], format: "enum" },
      },
      required: ["step_number", "instruction", "expected_target", "status"],
    },
  },
  {
    name: "complete_service_session",
    description: "Close the call once the root cause is confirmed and verified by readings.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        confirmed_root_cause: { type: Type.STRING },
        parts_replaced: { type: Type.ARRAY, items: { type: Type.STRING } },
        dispatch_summary_report: {
          type: Type.STRING,
          description: "Dispatch-ready summary for ServiceTitan / Housecall Pro: findings, readings, repair, follow-up.",
        },
      },
      required: ["confirmed_root_cause", "parts_replaced", "dispatch_summary_report"],
    },
  },
];

/** Live session config. Used as the locked ephemeral-token constraint and by the browser connect call. */
export function buildLiveConnectConfig(): LiveConnectConfig {
  return {
    responseModalities: [Modality.AUDIO],
    systemInstruction: HVAC_SYSTEM_INSTRUCTION,
    tools: [{ functionDeclarations: HVAC_FUNCTION_DECLARATIONS }],
    inputAudioTranscription: {},
    outputAudioTranscription: {},
    // Audio + video sessions are capped at ~2 minutes without compression.
    contextWindowCompression: { slidingWindow: {} },
  };
}

/* ------------------------------------------------------------------ */
/* Typed tool calls + strict validation                                */
/* ------------------------------------------------------------------ */

export type RegisterEquipmentArgs = {
  manufacturer: string;
  model_number: string;
  serial_number?: string;
  equipment_type: string;
  refrigerant_type?: string;
  tonnage?: number;
};
export type VerifySafetyArgs = {
  verified: boolean;
  verification_method: (typeof VERIFICATION_METHODS)[number];
  notes: string;
};
export type LogReadingArgs = {
  reading_type: ReadingType;
  numeric_value: number;
  unit: string;
  is_within_spec: boolean;
  target_spec_note: string;
};
export type AdvanceStepArgs = {
  step_number: number;
  instruction: string;
  expected_target: string;
  status: (typeof STEP_STATUSES)[number];
};
export type CompleteSessionArgs = {
  confirmed_root_cause: string;
  parts_replaced: string[];
  dispatch_summary_report: string;
};

export type HvacToolCall =
  | { name: "register_equipment_plate"; args: RegisterEquipmentArgs }
  | { name: "verify_safety_disconnect"; args: VerifySafetyArgs }
  | { name: "log_diagnostic_reading"; args: LogReadingArgs }
  | { name: "advance_diagnostic_step"; args: AdvanceStepArgs }
  | { name: "complete_service_session"; args: CompleteSessionArgs };

export type HvacToolName = HvacToolCall["name"];

export type ParseResult = { ok: true; call: HvacToolCall } | { ok: false; error: string };

type Obj = Record<string, unknown>;

const MAX_TEXT = 4000;

function str(o: Obj, key: string, required: true): string;
function str(o: Obj, key: string, required: false): string | undefined;
function str(o: Obj, key: string, required: boolean): string | undefined {
  const v = o[key];
  if (v === undefined || v === null || (typeof v === "string" && v.trim() === "")) {
    if (required) throw new Error(`${key} is required`);
    return undefined;
  }
  if (typeof v !== "string") throw new Error(`${key} must be a string`);
  return v.trim().slice(0, MAX_TEXT);
}

function num(o: Obj, key: string, required: boolean): number | undefined {
  const v = o[key];
  if (v === undefined || v === null) {
    if (required) throw new Error(`${key} is required`);
    return undefined;
  }
  const n = typeof v === "string" ? Number(v) : v;
  if (typeof n !== "number" || !Number.isFinite(n)) throw new Error(`${key} must be a finite number`);
  return n;
}

function bool(o: Obj, key: string): boolean {
  const v = o[key];
  if (typeof v !== "boolean") throw new Error(`${key} must be true or false`);
  return v;
}

function oneOf<T extends string>(o: Obj, key: string, options: readonly T[]): T {
  const v = o[key];
  if (typeof v !== "string" || !(options as readonly string[]).includes(v)) {
    throw new Error(`${key} must be one of: ${options.join(", ")}`);
  }
  return v as T;
}

/** Validate a raw function call from the model (or a client request) into a typed HvacToolCall. */
export function parseToolCall(name: unknown, rawArgs: unknown): ParseResult {
  const args: Obj = rawArgs && typeof rawArgs === "object" && !Array.isArray(rawArgs) ? (rawArgs as Obj) : {};
  try {
    switch (name) {
      case "register_equipment_plate": {
        const tonnage = num(args, "tonnage", false);
        // equipment_units.tonnage is numeric(4,2): light-commercial RTUs top out well below 100 tons.
        if (tonnage !== undefined && (tonnage <= 0 || tonnage >= 100)) throw new Error("tonnage must be greater than 0 and below 100");
        return {
          ok: true,
          call: {
            name,
            args: {
              manufacturer: str(args, "manufacturer", true),
              model_number: str(args, "model_number", true),
              serial_number: str(args, "serial_number", false),
              equipment_type: str(args, "equipment_type", true),
              refrigerant_type: str(args, "refrigerant_type", false),
              tonnage,
            },
          },
        };
      }
      case "verify_safety_disconnect":
        return {
          ok: true,
          call: {
            name,
            args: {
              verified: bool(args, "verified"),
              verification_method: oneOf(args, "verification_method", VERIFICATION_METHODS),
              notes: str(args, "notes", true),
            },
          },
        };
      case "log_diagnostic_reading":
        return {
          ok: true,
          call: {
            name,
            args: {
              reading_type: oneOf(args, "reading_type", READING_TYPES),
              numeric_value: (() => {
                const v = num(args, "numeric_value", true)!;
                if (Math.abs(v) >= 1e8) throw new Error("numeric_value is out of range");
                return Math.round(v * 100) / 100;
              })(),
              unit: str(args, "unit", true),
              is_within_spec: bool(args, "is_within_spec"),
              target_spec_note: str(args, "target_spec_note", true),
            },
          },
        };
      case "advance_diagnostic_step": {
        const step = num(args, "step_number", true)!;
        if (!Number.isInteger(step) || step < 1 || step > DIAGNOSTIC_SEQUENCE.length) {
          throw new Error(`step_number must be an integer from 1 to ${DIAGNOSTIC_SEQUENCE.length}`);
        }
        return {
          ok: true,
          call: {
            name,
            args: {
              step_number: step,
              instruction: str(args, "instruction", true),
              expected_target: str(args, "expected_target", true),
              status: oneOf(args, "status", STEP_STATUSES),
            },
          },
        };
      }
      case "complete_service_session": {
        const parts = args.parts_replaced ?? [];
        if (!Array.isArray(parts) || parts.some((p) => typeof p !== "string")) {
          throw new Error("parts_replaced must be an array of strings");
        }
        return {
          ok: true,
          call: {
            name,
            args: {
              confirmed_root_cause: str(args, "confirmed_root_cause", true),
              parts_replaced: (parts as string[]).map((p) => p.trim()).filter(Boolean).slice(0, 50),
              dispatch_summary_report: str(args, "dispatch_summary_report", true),
            },
          },
        };
      }
      default:
        return { ok: false, error: `Unknown tool: ${String(name)}` };
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Invalid arguments" };
  }
}

export const READING_LABELS: Record<ReadingType, string> = {
  suction_psi: "Suction",
  liquid_psi: "Liquid",
  superheat: "Superheat",
  subcooling: "Subcooling",
  amp_draw: "Amp Draw",
  voltage: "Voltage",
  static_pressure: "Static Pressure",
  capacitance_uf: "Capacitance",
};
