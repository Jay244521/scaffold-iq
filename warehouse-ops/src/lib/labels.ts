export const EXCEPTION_TYPES = ["shortage", "overage", "damaged", "wrong_item", "other"] as const;
export type ExceptionType = (typeof EXCEPTION_TYPES)[number];

export const EXCEPTION_LABELS: Record<ExceptionType, string> = {
  shortage: "Shortage",
  overage: "Overage",
  damaged: "Damaged product",
  wrong_item: "Wrong item",
  other: "Other discrepancy",
};

export const EXCEPTION_HINTS: Record<ExceptionType, string> = {
  shortage: "Received less than expected",
  overage: "Received more than expected",
  damaged: "Product or packaging damaged",
  wrong_item: "Item doesn't match the order",
  other: "Any other receiving issue",
};

export const STATUSES = ["open", "in_progress", "resolved", "closed"] as const;
export type IncidentStatus = (typeof STATUSES)[number];

export const STATUS_LABELS: Record<IncidentStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  resolved: "Resolved",
  closed: "Closed",
};

export const incidentRef = (n: number) => `EX-${n}`;

export function formatQty(v: number | string | null | undefined) {
  if (v === null || v === undefined || v === "") return "—";
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString("en-US", { maximumFractionDigits: 3 }) : "—";
}

/** Received minus expected; null when either is missing. */
export function variance(expected: number | string | null, received: number | string | null) {
  if (expected === null || received === null || expected === "" || received === "") return null;
  const d = Number(received) - Number(expected);
  return Number.isFinite(d) ? d : null;
}

export const displayName = (p: { full_name?: string | null; email?: string | null } | null | undefined) =>
  p?.full_name?.trim() || p?.email || "Unknown user";

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
