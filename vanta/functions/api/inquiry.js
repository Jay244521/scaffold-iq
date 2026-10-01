// Cloudflare Pages Function: POST /api/inquiry
// Required env vars (set in Cloudflare dashboard, never in frontend code):
//   RESEND_API_KEY      - Resend API key (secret)
//   TO_EMAIL            - where inquiries are delivered
//   FROM_EMAIL          - verified sender, e.g. "Vanta <inquiries@yourdomain.com>"
// Optional:
//   TURNSTILE_SECRET_KEY - Cloudflare Turnstile secret (enables bot check)

const LIMITS = { name: 100, company: 120, email: 160, phone: 40, category: 80, need: 3000, volume: 160, timeline: 120 };

export async function onRequestPost({ request, env }) {
  const wantsJson = (request.headers.get("accept") || "").includes("application/json");
  const reply = (ok, status, message) =>
    wantsJson
      ? Response.json({ ok, message }, { status })
      : Response.redirect(new URL(ok ? "/?sent=1#inquiry" : "/?error=1#inquiry", request.url), 303);

  let form;
  try { form = await request.formData(); } catch { return reply(false, 400, "Invalid submission."); }

  // Honeypot: pretend success so bots learn nothing
  if ((form.get("website") || "").toString().trim() !== "") return reply(true, 200, "Sent.");

  const v = {};
  for (const [key, max] of Object.entries(LIMITS)) {
    v[key] = (form.get(key) || "").toString().trim().slice(0, max);
  }
  if (!v.name || !v.company || !v.need || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.email)) {
    return reply(false, 400, "Please complete all required fields with a valid email.");
  }
  // Prevent header-injection style input in single-line fields
  for (const k of ["name", "company", "email", "phone", "category", "volume", "timeline"]) {
    if (/[\r\n]/.test(v[k])) return reply(false, 400, "Invalid characters in form.");
  }

  if (!env.RESEND_API_KEY || !env.TO_EMAIL || !env.FROM_EMAIL) {
    console.error("Missing RESEND_API_KEY, TO_EMAIL, or FROM_EMAIL");
    return reply(false, 500, "Form is not configured yet. Please email us directly.");
  }

  // Optional Turnstile verification
  if (env.TURNSTILE_SECRET_KEY) {
    const token = (form.get("cf-turnstile-response") || "").toString();
    const body = new URLSearchParams({
      secret: env.TURNSTILE_SECRET_KEY,
      response: token,
      remoteip: request.headers.get("CF-Connecting-IP") || ""
    });
    try {
      const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body });
      const d = await r.json();
      if (!d.success) return reply(false, 400, "Spam check failed. Please try again.");
    } catch {
      return reply(false, 502, "Could not verify spam check. Please try again.");
    }
  }

  const text = [
    "New Vanta inquiry",
    "",
    `Name: ${v.name}`,
    `Company: ${v.company}`,
    `Email: ${v.email}`,
    `Phone: ${v.phone || "-"}`,
    `Category: ${v.category || "-"}`,
    `Volume/frequency: ${v.volume || "-"}`,
    `Timeline: ${v.timeline || "-"}`,
    "",
    "Need:",
    v.need
  ].join("\n");

  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: env.FROM_EMAIL,
        to: [env.TO_EMAIL],
        reply_to: v.email,
        subject: `Vanta inquiry: ${v.company}`,
        text
      })
    });
    if (!r.ok) {
      console.error("Resend error", r.status, await r.text());
      return reply(false, 502, "We couldn't send your inquiry. Please try again or email us directly.");
    }
  } catch (err) {
    console.error("Resend fetch failed", err);
    return reply(false, 502, "We couldn't send your inquiry. Please try again or email us directly.");
  }

  return reply(true, 200, "Sent.");
}

export function onRequest() {
  return new Response("Method not allowed", { status: 405, headers: { Allow: "POST" } });
}
