/** The 5-step ApexField diagnostic sequence, shared by the live coach, the simulator and the fleet dashboard. */
export const DIAGNOSTIC_SEQUENCE = [
  "Identify equipment data plate",
  "Verify 24V control signal",
  "High-voltage disconnect verification",
  "Contactor / capacitor / amp draw",
  "Refrigerant pressures, superheat & subcooling",
] as const;

/** Step number (1-based) of the high-voltage safety gate. */
export const SAFETY_STEP = 3;
