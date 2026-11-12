/**
 * Deterministic state for a live coaching session.
 *
 * The model proposes actions through function calls; this module decides
 * whether they are allowed. Safety and sequencing rules live here in code,
 * not in the prompt, so a model mistake cannot unlock electrical work.
 */
import {
  DE_ENERGIZED_READINGS,
  DIAGNOSTIC_SEQUENCE,
  READING_LABELS,
  SAFETY_STEP,
  parseToolCall,
  type AdvanceStepArgs,
  type CompleteSessionArgs,
  type HvacToolCall,
  type LogReadingArgs,
  type RegisterEquipmentArgs,
  type VerifySafetyArgs,
} from "./hvac-tools";

export type LiveReading = LogReadingArgs & { id: string; at: string };
export type LiveStep = AdvanceStepArgs & { at: string };
export type SafetyState = { verified: false } | ({ verified: true; at: string } & Omit<VerifySafetyArgs, "verified">);

export type LiveSessionState = {
  equipment: (RegisterEquipmentArgs & { at: string }) | null;
  safety: SafetyState;
  readings: LiveReading[];
  /** Latest update per step number (1-based). */
  steps: Record<number, LiveStep>;
  currentStep: number;
  completion: (CompleteSessionArgs & { at: string }) | null;
  /** Rejected tool calls, surfaced so the tech can see the gate working. */
  blocked: { name: string; reason: string; at: string }[];
};

export const initialLiveState: LiveSessionState = {
  equipment: null,
  safety: { verified: false },
  readings: [],
  steps: {},
  currentStep: 1,
  completion: null,
  blocked: [],
};

/** What the model gets back. `output` = success, `error` = rule the model must follow. */
export type ToolResponse = { output: Record<string, unknown> } | { error: string };

export type ToolOutcome = {
  state: LiveSessionState;
  response: ToolResponse;
  /** Validated call to persist, only when the call was accepted. */
  accepted: HvacToolCall | null;
};

let seq = 0;
const nextId = () => `r${Date.now().toString(36)}${(seq++).toString(36)}`;

function block(state: LiveSessionState, name: string, reason: string, at: string): ToolOutcome {
  return {
    state: { ...state, blocked: [...state.blocked, { name, reason, at }].slice(-20) },
    response: { error: reason },
    accepted: null,
  };
}

/**
 * Apply one function call from the model. Pure: returns the next state and the
 * response to send back to Gemini.
 */
export function applyToolCall(
  state: LiveSessionState,
  name: string,
  rawArgs: unknown,
  at: string = new Date().toISOString(),
): ToolOutcome {
  const parsed = parseToolCall(name, rawArgs);
  if (!parsed.ok) return block(state, name, `Invalid call: ${parsed.error}. Re-check the values and call again.`, at);
  const call = parsed.call;

  if (state.completion && call.name !== "complete_service_session") {
    return block(state, call.name, "This service session is already complete. Do not log further actions.", at);
  }

  switch (call.name) {
    case "register_equipment_plate": {
      const a = call.args;
      return {
        state: { ...state, equipment: { ...a, at }, currentStep: Math.max(state.currentStep, 1) },
        response: {
          output: {
            registered: true,
            equipment: `${a.manufacturer} ${a.model_number}${a.tonnage ? ` · ${a.tonnage} ton` : ""}${a.refrigerant_type ? ` · ${a.refrigerant_type}` : ""}`,
            next: "Proceed to step 2: verify the 24V control signal.",
          },
        },
        accepted: call,
      };
    }

    case "verify_safety_disconnect": {
      const a = call.args;
      if (!a.verified) {
        return {
          state: { ...state, safety: { verified: false } },
          response: {
            output: {
              safety_disconnect_verified: false,
              electrical_steps: "locked",
              instruction: "Disconnect is NOT verified. Electrical components stay locked until 0V is confirmed.",
            },
          },
          accepted: call,
        };
      }
      return {
        state: {
          ...state,
          safety: { verified: true, verification_method: a.verification_method, notes: a.notes, at },
          currentStep: Math.max(state.currentStep, SAFETY_STEP),
        },
        response: {
          output: {
            safety_disconnect_verified: true,
            electrical_steps: "unlocked",
            next: "Step 4 is unlocked: contactor, capacitor and amp draw.",
          },
        },
        accepted: call,
      };
    }

    case "log_diagnostic_reading": {
      const a = call.args;
      if (DE_ENERGIZED_READINGS.includes(a.reading_type) && !state.safety.verified) {
        return block(
          state,
          call.name,
          `SAFETY GATE LOCKED: a ${READING_LABELS[a.reading_type].toLowerCase()} reading requires the high-voltage disconnect to be pulled and 0V verified first. Tell the technician to stop, pull the disconnect and confirm 0V across L1/L2, then call verify_safety_disconnect.`,
          at,
        );
      }
      const reading: LiveReading = { ...a, id: nextId(), at };
      return {
        state: { ...state, readings: [...state.readings, reading] },
        response: {
          output: {
            logged: true,
            reading: `${READING_LABELS[a.reading_type]} ${a.numeric_value} ${a.unit}`,
            within_spec: a.is_within_spec,
            total_readings: state.readings.length + 1,
          },
        },
        accepted: call,
      };
    }

    case "advance_diagnostic_step": {
      const a = call.args;
      const pastGate = a.step_number > SAFETY_STEP || (a.step_number === SAFETY_STEP && a.status === "passed");
      if (pastGate && !state.safety.verified) {
        return block(
          state,
          call.name,
          `SAFETY GATE LOCKED: step ${a.step_number} (${DIAGNOSTIC_SEQUENCE[a.step_number - 1]}) cannot start until the high-voltage disconnect is verified. Call verify_safety_disconnect after you see the disconnect pulled or hear the tech confirm 0V.`,
          at,
        );
      }
      const steps = { ...state.steps, [a.step_number]: { ...a, at } };
      const currentStep =
        a.status === "in_progress"
          ? a.step_number
          : Math.min(DIAGNOSTIC_SEQUENCE.length, Math.max(state.currentStep, a.step_number + (a.status === "passed" ? 1 : 0)));
      return {
        state: { ...state, steps, currentStep },
        response: { output: { step_number: a.step_number, status: a.status, current_step: currentStep } },
        accepted: call,
      };
    }

    case "complete_service_session": {
      if (state.completion) {
        return block(state, call.name, "The session is already complete.", at);
      }
      if (state.readings.length === 0) {
        return block(
          state,
          call.name,
          "Cannot close the call: no readings have been logged. Confirm the root cause with at least one measured reading via log_diagnostic_reading first.",
          at,
        );
      }
      return {
        state: { ...state, completion: { ...call.args, at } },
        response: { output: { completed: true, readings_on_record: state.readings.length } },
        accepted: call,
      };
    }
  }
}
