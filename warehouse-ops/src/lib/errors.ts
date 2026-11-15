/**
 * Converts database / API errors into messages that are safe to show users.
 * Business-rule messages raised by our own database functions are shown as-is;
 * anything that could reveal internals (constraint names, SQL) is replaced.
 */
type DbError = { code?: string; message?: string } | null | undefined;

const RULE_CODES = new Set(["42501", "23514", "22023", "P0002", "54000", "23505"]);

export function friendlyError(err: DbError, fallback = "Something went wrong. Please try again."): string {
  if (!err) return fallback;
  const msg = err.message ?? "";
  const code = err.code ?? "";
  const internal = /violates|permission denied|duplicate key|syntax|relation|column|function|schema/i.test(msg);

  if (!internal && RULE_CODES.has(code) && msg.length > 0 && msg.length < 200) return msg;
  if (code === "42501" || /row-level security|permission denied/i.test(msg)) return "You don't have permission to do that.";
  if (code === "23505") return "That already exists.";
  if (code === "23503") return "A related record could not be found. Refresh the page and try again.";
  if (code === "23514" || code === "22P02" || code === "22001") return "Some values are not valid. Check the form and try again.";
  if (code === "PGRST116") return "That record could not be found.";
  return fallback;
}

/** Logs the technical details server-side only. */
export function logError(context: string, err: unknown) {
  const detail = err && typeof err === "object" ? JSON.stringify(err, Object.getOwnPropertyNames(err)) : String(err);
  console.error(`[warehouse-ops] ${context}: ${detail}`);
}
