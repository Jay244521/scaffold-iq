/** Shared validation for account forms (client and server). */
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function cleanText(v: unknown, max: number): string {
  return typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

export function validatePassword(p: unknown): string | null {
  if (typeof p !== "string" || p.length < 8) return "Password must be at least 8 characters.";
  if (p.length > 72) return "Password must be 72 characters or fewer.";
  return null;
}

export function validateEmail(e: unknown): string | null {
  return typeof e === "string" && EMAIL_RE.test(e.trim()) && e.length <= 254 ? null : "Enter a valid email address.";
}
