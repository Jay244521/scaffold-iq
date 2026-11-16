/**
 * Evidence file rules shared by the browser (fast feedback) and the server
 * (authoritative). The server also checks the file's actual bytes, because a
 * browser-supplied file name or type can be faked.
 */
export const MAX_EVIDENCE_BYTES = 10 * 1024 * 1024;

/** "signed_bol" = the signed bill of lading / delivery receipt: proof of what was signed for at the dock. */
export const EVIDENCE_KINDS = ["evidence", "signed_bol"] as const;
export type EvidenceKind = (typeof EVIDENCE_KINDS)[number];
export const isEvidenceKind = (v: unknown): v is EvidenceKind => typeof v === "string" && (EVIDENCE_KINDS as readonly string[]).includes(v);
export const MAX_FILES_PER_BATCH = 10;

export const ALLOWED_EVIDENCE_TYPES: Record<string, string[]> = {
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/webp": ["webp"],
  "image/heic": ["heic"],
  "image/heif": ["heif"],
  "application/pdf": ["pdf"],
};
export const EVIDENCE_ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf";

const startsWith = (b: Uint8Array, sig: number[], offset = 0) => sig.every((v, i) => b[offset + i] === v);
const ascii = (b: Uint8Array, from: number, to: number) => String.fromCharCode(...b.slice(from, to));

/** Detects the real file type from its first bytes. Returns null for anything not allowed. */
export function sniffEvidenceType(head: Uint8Array): string | null {
  if (head.length < 12) return null;
  if (startsWith(head, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(head, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (ascii(head, 0, 4) === "RIFF" && ascii(head, 8, 12) === "WEBP") return "image/webp";
  if (ascii(head, 0, 5) === "%PDF-") return "application/pdf";
  if (ascii(head, 4, 8) === "ftyp") {
    const brand = ascii(head, 8, 12);
    if (["heic", "heix", "hevc", "hevx", "heim", "heis"].includes(brand)) return "image/heic";
    if (["mif1", "msf1"].includes(brand)) return "image/heif";
  }
  return null;
}

export const sameEvidenceFamily = (a: string, b: string) =>
  a === b || (["image/heic", "image/heif"].includes(a) && ["image/heic", "image/heif"].includes(b));

/** A storage-safe file name: no paths, no odd characters, sensible length. */
export function safeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "file";
  const cleaned = base
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^[._]+/, "");
  const dot = cleaned.lastIndexOf(".");
  const ext = dot > 0 ? cleaned.slice(dot + 1, dot + 6).toLowerCase() : "";
  const stem = (dot > 0 ? cleaned.slice(0, dot) : cleaned).slice(0, 80) || "file";
  return ext ? `${stem}.${ext}` : stem;
}

export type EvidenceCheck = { ok: true } | { ok: false; error: string };

/** Pre-upload checks on name, declared type and size (browser and server). */
export function checkEvidenceFile(name: string, type: string, size: number): EvidenceCheck {
  if (size <= 0) return { ok: false, error: `${name}: the file is empty` };
  if (size > MAX_EVIDENCE_BYTES) return { ok: false, error: `${name}: files must be 10 MB or smaller` };
  const exts = ALLOWED_EVIDENCE_TYPES[type];
  if (!exts) return { ok: false, error: `${name}: only JPEG, PNG, WebP, HEIC photos and PDF documents are allowed` };
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const allExts = Object.values(ALLOWED_EVIDENCE_TYPES).flat();
  if (!allExts.includes(ext)) return { ok: false, error: `${name}: the file extension isn't allowed` };
  return { ok: true };
}

/** Builds the storage path. Storage policies require {org}/{incident}/ as the prefix. */
export const evidencePath = (orgId: string, incidentId: string, fileId: string, name: string) =>
  `${orgId}/${incidentId}/${fileId}-${safeFileName(name)}`;
