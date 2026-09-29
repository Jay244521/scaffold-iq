// AURA waitlist
//
// Paste a form endpoint here to start collecting emails. A free Formspree form
// (https://formspree.io) works as-is: create a form and use its URL, e.g.
// "https://formspree.io/f/abcdwxyz". Any endpoint that accepts a JSON POST of
// { email, source } and returns a 2xx status will also work.
const WAITLIST_ENDPOINT = "";

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
    console.warn("AURA: WAITLIST_ENDPOINT is not set in assets/script.js, so this sign-up was not saved.");
    setMessage(form, "The waitlist opens shortly. Follow @aurasnacks for the drop.", "error");
    return;
  }

  button.disabled = true;
  setMessage(form, "Reserving your spot…");

  try {
    const res = await fetch(WAITLIST_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ email, source: form.closest("section")?.id || "site" }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
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
