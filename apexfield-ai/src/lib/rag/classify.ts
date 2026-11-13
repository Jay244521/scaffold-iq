/**
 * Chunk-type classification, model-number extraction and brand detection for
 * HVAC OEM manuals. Keyword scoring is deliberate: it is predictable, cheap and
 * easy to tune, and the chunk_type only needs to be good enough to filter on.
 */

export const CHUNK_TYPES = [
  "specifications",
  "charging_chart",
  "error_codes",
  "wiring",
  "troubleshooting",
  "installation",
  "maintenance",
  "safety",
  "general",
] as const;
export type ChunkType = (typeof CHUNK_TYPES)[number];

type Rule = { type: ChunkType; patterns: RegExp[]; tableHeader?: RegExp };

const RULES: Rule[] = [
  {
    type: "error_codes",
    patterns: [/\b(error|fault|alarm|diagnostic|trouble|status)\s+codes?\b/gi, /\b(flash(es|ing)?|blinks?)\b/gi, /\bLED\b/g, /\b[EFLP][0-9]{1,3}\b/g],
    tableHeader: /\b(code|flash|led|blink)/i,
  },
  {
    type: "charging_chart",
    patterns: [/\bsub-?cool(ing)?\b/gi, /\bsuper-?heat\b/gi, /\bcharg(e|ing)\b/gi, /\bliquid (line|pressure)\b/gi, /\bsuction (line|pressure)\b/gi, /\bpsig?\b/gi],
    tableHeader: /(sub-?cool|super-?heat|pressure|psi|liquid|suction|outdoor.*temp)/i,
  },
  {
    type: "specifications",
    patterns: [/\b(RLA|LRA|FLA|MCA|MOCP|SEER2?|EER2?|HSPF2?)\b/g, /\b(electrical|physical|performance)\s+data\b/gi, /\bBTU[H/]?\b/gi, /\bcapacity\b/gi, /\bdimensions?\b/gi, /\bvolts?-ph(ase)?-hz\b/gi],
    tableHeader: /\b(model|rla|lra|fla|mca|mocp|btu|seer|volts?|capacity|weight)\b/i,
  },
  {
    type: "wiring",
    patterns: [/\bwir(e|es|ing)\b/gi, /\bschematic\b/gi, /\bterminals?\b/gi, /\bcontactor\b/gi, /\btransformer\b/gi, /\b24\s?v(ac)?\b/gi, /\bL1\b|\bL2\b/g, /\b(thermostat|stat)\b/gi, /\b[RCYWG][12]?\b(?=\s*(terminal|wire|to))/g],
  },
  {
    type: "troubleshooting",
    patterns: [/\btroubleshoot(ing)?\b/gi, /\bsymptoms?\b/gi, /\b(possible|probable) causes?\b/gi, /\b(remedy|corrective action|check for)\b/gi],
    tableHeader: /\b(symptom|cause|remedy|action|check)\b/i,
  },
  {
    type: "installation",
    patterns: [/\binstall(ation|ing|ed)?\b/gi, /\bclearances?\b/gi, /\bline ?set\b/gi, /\bbraz(e|ing)\b/gi, /\bevacuat(e|ion)\b/gi, /\bmount(ing)?\b/gi, /\bpad\b/gi],
  },
  {
    type: "maintenance",
    patterns: [/\bmaintenance\b/gi, /\bclean(ing)?\b/gi, /\bfilters?\b/gi, /\blubricat(e|ion)\b/gi, /\binspect(ion)?\b/gi],
  },
];

const SAFETY_LEAD = /^\s*(warning|danger|caution)\b/i;

/** Classify chunk text; `section` (heading path) counts double, table header rows count triple. */
export function classifyChunk(content: string, section: string, tableHeader?: string[]): ChunkType {
  if (SAFETY_LEAD.test(content) && content.length < 1600) return "safety";
  const scores = new Map<ChunkType, number>();
  const header = tableHeader?.join(" ") ?? "";
  for (const rule of RULES) {
    let s = 0;
    for (const re of rule.patterns) {
      s += (content.match(re)?.length ?? 0) + 2 * (section.match(re)?.length ?? 0);
    }
    if (rule.tableHeader && header && rule.tableHeader.test(header)) s += 3 * (header.match(new RegExp(rule.tableHeader.source, "gi"))?.length ?? 1);
    scores.set(rule.type, s);
  }
  const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1]);
  const [type, score] = ranked[0];
  if (score >= 2) return type;
  return /\b(warning|danger|caution)\b/i.test(content) ? "safety" : "general";
}

/* ------------------------------ model numbers ------------------------------ */

// 6–20 chars, letters+digits (dashes allowed), at least 2 of each, e.g. 24ACC636A003, 4TWR6036H1000A, ML14XC1-036.
const MODEL_TOKEN = /\b(?=[A-Z0-9-]*\d[A-Z0-9-]*\d)(?=[A-Z0-9-]*[A-Z][A-Z0-9-]*[A-Z])[A-Z0-9][A-Z0-9-]{4,18}[A-Z0-9]\*?/g;
const NOT_A_MODEL = [
  /^R-?\d{2,3}[A-Z]?$/, // refrigerants
  /^\d+(V|VAC|HZ|PH|PSIG?|BTUH?|CFM|MBH|KW|AWG|MM|IN|FT|LBS?)$/, // values with units
  /^\d{2,3}-\d{2,3}V?$/,
  /^(UL|CSA|ETL|ANSI|ASHRAE|AHRI|NEC|NFPA|ISO)\d*/,
  /^(SEER|EER|HSPF)\d/,
];

export function extractModelNumbers(text: string, limit = 20): string[] {
  const out = new Set<string>();
  for (const m of text.toUpperCase().matchAll(MODEL_TOKEN)) {
    const tok = m[0].replace(/\*$/, "").replace(/-+$/, "");
    if (tok.length < 6 || NOT_A_MODEL.some((re) => re.test(tok))) continue;
    out.add(tok);
    if (out.size >= limit) break;
  }
  return [...out];
}

/* ------------------------------ brand detection ------------------------------ */

const BRANDS = [
  "Carrier", "Bryant", "Payne", "Trane", "American Standard", "Lennox", "Daikin", "Goodman", "Amana", "York",
  "Coleman", "Luxaire", "Rheem", "Ruud", "Mitsubishi Electric", "Fujitsu", "LG", "Samsung", "Bosch", "Heil",
  "Tempstar", "Comfortmaker", "Armstrong Air", "Ducane", "Nordyne", "Frigidaire", "Gibson", "Maytag", "AAON",
];

/** Most frequently mentioned known brand, or null. */
export function detectManufacturer(text: string): string | null {
  let best: [string, number] | null = null;
  for (const b of BRANDS) {
    const n = text.match(new RegExp(`\\b${b.replace(/ /g, "\\s+")}\\b`, b.length <= 3 ? "g" : "gi"))?.length ?? 0;
    if (n > 0 && (!best || n > best[1])) best = [b, n];
  }
  return best && best[1] >= 2 ? best[0] : null;
}
