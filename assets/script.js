// AURA waitlist
//
// Sign-ups are stored in the Supabase table public.aura_waitlist. The key below
// is Supabase's *publishable* key, which is safe to ship in a public page: the
// table's permissions let visitors add their email but never read, edit or
// delete the list. View sign-ups in the Supabase dashboard (Table Editor).
const SUPABASE_URL = "https://bkstqsewmsmotpqwwhmj.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_UMgFjI_Upj1ACaSPcvlGGQ_S2lDgUUm";
const WAITLIST_ENDPOINT = SUPABASE_URL ? `${SUPABASE_URL}/rest/v1/aura_waitlist` : "";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function setMessage(form, text, state) {
  const msg = form.querySelector(".signup__msg");
  msg.textContent = text;
  msg.dataset.state = state || "";
}

async function handleSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const input = form.querySelector('input[type="email"]');
  const button = form.querySelector('button[type="submit"]');
  const email = input.value.trim();

  if (!EMAIL_RE.test(email)) {
    setMessage(form, "Please enter a valid email address.", "error");
    input.focus();
    return;
  }

  if (!WAITLIST_ENDPOINT) {
    console.warn("AURA: SUPABASE_URL is not set in assets/script.js, so this sign-up was not saved.");
    setMessage(form, "The waitlist opens shortly. Follow @aurasnacks for the drop.", "error");
    return;
  }

  button.disabled = true;
  setMessage(form, "Reserving your spot…");

  try {
    const res = await fetch(WAITLIST_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ email, source: form.closest("section")?.id || "site" }),
    });
    // 409 = this email is already on the list, which is a success for the visitor.
    if (!res.ok && res.status !== 409) throw new Error(`HTTP ${res.status}`);
    form.reset();
    setMessage(form, "You're on the list. We'll email you when Drop 01 opens.", "ok");
  } catch (err) {
    console.error("AURA waitlist error:", err);
    setMessage(form, "Something went wrong. Please try again.", "error");
  } finally {
    button.disabled = false;
  }
}

document.querySelectorAll("form[data-waitlist]").forEach((form) => {
  form.addEventListener("submit", handleSubmit);
});

document.querySelectorAll("[data-year]").forEach((el) => {
  el.textContent = new Date().getFullYear();
});
