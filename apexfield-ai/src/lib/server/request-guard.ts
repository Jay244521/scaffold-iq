import "server-only";
import { NextResponse } from "next/server";

/**
 * Lightweight abuse guards for the public live-session routes.
 * - Same-origin: browsers always send Origin on POST; reject cross-site callers.
 * - Per-IP sliding-window rate limit. In-memory, so it is per server instance:
 *   enough to stop casual quota burn, not a substitute for auth / an edge limiter.
 */
const buckets = new Map<string, number[]>();

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd?.split(",")[0] ?? req.headers.get("x-real-ip") ?? "unknown").trim();
}

export function guardRequest(
  req: Request,
  opts: { key: string; limit: number; windowMs: number; /** Rate-limit per user instead of per IP. */ subject?: string },
): NextResponse | null {
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (origin && host) {
    let originHost: string | null = null;
    try {
      originHost = new URL(origin).host;
    } catch {
      /* malformed */
    }
    if (originHost !== host) {
      return NextResponse.json({ error: "Cross-origin requests are not allowed." }, { status: 403 });
    }
  }

  const id = `${opts.key}:${opts.subject ?? clientIp(req)}`;
  const now = Date.now();
  const hits = (buckets.get(id) ?? []).filter((t) => now - t < opts.windowMs);
  if (hits.length >= opts.limit) {
    const retry = Math.ceil((opts.windowMs - (now - hits[0])) / 1000);
    return NextResponse.json(
      { error: "Too many requests. Try again shortly." },
      { status: 429, headers: { "Retry-After": String(retry) } },
    );
  }
  hits.push(now);
  buckets.set(id, hits);
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) if (!v.some((t) => now - t < opts.windowMs)) buckets.delete(k);
  }
  return null;
}
