/**
 * Map free-text values from Gemini tool calls onto the vocabulary used by the
 * coaching schema (see supabase/migrations/20261112214003_hvac_coaching_schema.sql).
 */

/** Matches the equipment_type vocabulary in the schema: split_ac | heat_pump | gas_furnace | rtu. */
export function normalizeEquipmentType(raw: string): string {
  const t = raw.toLowerCase();
  if (/heat\s*pump/.test(t)) return "heat_pump";
  if (/furnace|gas\s*heat/.test(t)) return "gas_furnace";
  if (/\brtu\b|roof\s*top|package[d]?\s*(unit|rtu|system)?/.test(t)) return "rtu";
  if (/split|condens|\bac\b|air\s*condition|air\s*handler/.test(t)) return "split_ac";
  return t.replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40) || "unknown";
}

/** Matches the unit vocabulary in the schema: psi | degF | amps | volts | inWC (plus uF for capacitors). */
export function normalizeUnit(raw: string): string {
  const u = raw.trim().toLowerCase().replace(/\s+/g, "");
  if (/^psi[ag]?$/.test(u)) return "psi";
  if (/^(°?f|deg\.?f|degreesf|fahrenheit)$/.test(u)) return "degF";
  if (/^(a|amps?|amperes?)$/.test(u)) return "amps";
  if (/^(v|vac|volts?)$/.test(u)) return "volts";
  if (/^(in\.?w\.?c\.?|inwc|"wc|inchesofwatercolumn|iwc)$/.test(u)) return "inWC";
  if (/^(µf|μf|uf|mfd|microfarads?)$/.test(u)) return "uF";
  return raw.trim().slice(0, 20);
}

/** Escape LIKE/ILIKE wildcards so a value matches literally (case-insensitively with ilike). */
export const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);
