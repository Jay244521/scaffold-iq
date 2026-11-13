import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { guardRequest } from "@/lib/server/request-guard";
import { cleanText, validateEmail } from "@/lib/auth/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FLEET_SIZES = ["1-5 Trucks", "6-25 Trucks", "26-75 Trucks", "75+ Trucks"];

/**
 * POST /api/demo-request
 * Body: { fullName, company, fleetSize, email, phone?, website? }
 *
 * "Book a Live Field Demo" leads from the marketing site, stored in demo_requests
 * (service role only). `website` is a hidden honeypot field: bots fill it, people don't.
 */
export async function POST(req: Request) {
  const blocked = guardRequest(req, { key: "demo-request", limit: 5, windowMs: 10 * 60_000 });
  if (blocked) return blocked;

  let b: Record<string, unknown>;
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (typeof b.website === "string" && b.website.trim()) return NextResponse.json({ ok: true }); // honeypot: pretend success

  const fullName = cleanText(b.fullName, 80);
  const company = cleanText(b.company, 120);
  const fleetSize = typeof b.fleetSize === "string" && FLEET_SIZES.includes(b.fleetSize) ? b.fleetSize : "";
  const email = typeof b.email === "string" ? b.email.trim().toLowerCase() : "";
  const phone = cleanText(b.phone, 40) || null;
  const err =
    (fullName.length < 2 && "Enter your name.") ||
    (company.length < 2 && "Enter your company name.") ||
    (!fleetSize && "Choose your fleet size.") ||
    validateEmail(email);
  if (err) return NextResponse.json({ error: err }, { status: 400 });

  const db = getSupabaseAdmin();
  if (!db) {
    console.warn("[demo-request] Supabase not configured; lead not stored:", { company, fleetSize });
    return NextResponse.json({ error: "We couldn't save your request right now. Email us instead." }, { status: 503 });
  }
  const { error } = await db.from("demo_requests").insert({
    full_name: fullName,
    company,
    fleet_size: fleetSize,
    email,
    phone,
    user_agent: req.headers.get("user-agent")?.slice(0, 300) ?? null,
  });
  if (error) {
    console.error("[demo-request] insert failed:", error.message);
    return NextResponse.json({ error: "We couldn't save your request right now. Please try again." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
