"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { CircleCheck, Loader2, X } from "lucide-react";

type DemoModalContextValue = { open: () => void };

const DemoModalContext = createContext<DemoModalContextValue | null>(null);

export function useDemoModal(): DemoModalContextValue {
  const ctx = useContext(DemoModalContext);
  if (!ctx) throw new Error("useDemoModal must be used inside <DemoModalProvider>");
  return ctx;
}

const FLEET_SIZES = ["1-5 Trucks", "6-25 Trucks", "26-75 Trucks", "75+ Trucks"] as const;

type FormState = {
  fullName: string;
  company: string;
  fleetSize: string;
  email: string;
  phone: string;
};

const EMPTY: FormState = { fullName: "", company: "", fleetSize: "", email: "", phone: "" };

export function DemoModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  return (
    <DemoModalContext.Provider value={{ open }}>
      {children}
      {isOpen && <DemoModal onClose={close} />}
    </DemoModalContext.Provider>
  );
}

function DemoModal({ onClose }: { onClose: () => void }) {
  const titleId = useId();
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [status, setStatus] = useState<"idle" | "submitting" | "done">("idle");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const honeypotRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    firstFieldRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab" && dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus();
    };
  }, [onClose]);

  const update = (key: keyof FormState) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus("submitting");
    setSubmitError(null);
    try {
      const res = await fetch("/api/demo-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, website: honeypotRef.current?.value ?? "" }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? "We couldn't send your request. Please try again.");
      setStatus("done");
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "We couldn't send your request. Please try again.");
      setStatus("idle");
    }
  };

  const inputClass =
    "min-h-12 w-full rounded-lg border border-line-strong bg-slate-deep px-3.5 text-base text-ink placeholder:text-muted/60 transition-colors focus:border-amber focus:outline-none";

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="animate-fade-up relative max-h-[95vh] w-full overflow-y-auto rounded-t-2xl border border-line bg-steel p-6 shadow-2xl sm:max-w-lg sm:rounded-2xl sm:p-8"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close demo booking form"
          className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-lg text-muted transition-colors hover:bg-steel-2 hover:text-ink"
        >
          <X className="h-5 w-5" />
        </button>

        {status === "done" ? (
          <div role="status" className="flex flex-col items-start gap-4 py-6">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald/15">
              <CircleCheck className="h-7 w-7 text-emerald" />
            </div>
            <h2 id={titleId} className="text-2xl font-extrabold tracking-tight">
              Demo request locked in.
            </h2>
            <p className="text-base leading-relaxed text-muted">
              Thanks, {form.fullName.split(" ")[0] || "there"}. A field specialist will contact you at{" "}
              <span className="font-mono text-ink">{form.email}</span> to schedule a live walkthrough on a real
              unit with {form.company || "your team"}.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-2 inline-flex min-h-12 items-center rounded-xl bg-amber px-6 font-bold text-slate-deep transition-colors hover:bg-amber-hi"
            >
              Back to site
            </button>
          </div>
        ) : (
          <>
            <p className="font-mono text-xs tracking-[0.08em] text-amber">LIVE FIELD DEMO</p>
            <h2 id={titleId} className="mt-2 pr-10 text-2xl font-extrabold tracking-tight">
              See it on a real unit.
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Scan, diagnose, verify and log, start to finish, with your service manager watching.
            </p>

            <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
              {/* Honeypot: hidden from people and assistive tech; bots tend to fill it. */}
              <input ref={honeypotRef} name="website" type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute -left-[9999px] h-px w-px opacity-0" />
              <Field label="Full Name" htmlFor="demo-name">
                <input
                  ref={firstFieldRef}
                  id="demo-name"
                  required
                  autoComplete="name"
                  value={form.fullName}
                  onChange={(e) => update("fullName")(e.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Company Name" htmlFor="demo-company">
                <input
                  id="demo-company"
                  required
                  autoComplete="organization"
                  value={form.company}
                  onChange={(e) => update("company")(e.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Fleet Size" htmlFor="demo-fleet">
                <select
                  id="demo-fleet"
                  required
                  value={form.fleetSize}
                  onChange={(e) => update("fleetSize")(e.target.value)}
                  className={inputClass}
                >
                  <option value="" disabled>
                    Select your fleet size
                  </option>
                  {FLEET_SIZES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Work Email" htmlFor="demo-email">
                  <input
                    id="demo-email"
                    type="email"
                    required
                    autoComplete="email"
                    value={form.email}
                    onChange={(e) => update("email")(e.target.value)}
                    className={inputClass}
                  />
                </Field>
                <Field label="Phone Number" htmlFor="demo-phone">
                  <input
                    id="demo-phone"
                    type="tel"
                    required
                    autoComplete="tel"
                    value={form.phone}
                    onChange={(e) => update("phone")(e.target.value)}
                    className={inputClass}
                  />
                </Field>
              </div>
              {submitError && (
                <p role="alert" className="rounded-lg border border-danger/50 bg-danger/10 px-3 py-2.5 text-sm text-red-200">
                  {submitError}
                </p>
              )}
              <button
                type="submit"
                disabled={status === "submitting"}
                className="mt-2 inline-flex min-h-13 items-center justify-center gap-2 rounded-xl bg-amber px-6 py-3.5 text-base font-bold text-slate-deep transition-all hover:bg-amber-hi active:scale-[0.99] disabled:opacity-70"
              >
                {status === "submitting" ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" /> Booking…
                  </>
                ) : (
                  "Book My Live Field Demo"
                )}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={htmlFor} className="text-sm font-semibold">
        {label}
      </label>
      {children}
    </div>
  );
}

export function DemoButton({
  children = "Book a Live Field Demo",
  className = "",
}: {
  children?: ReactNode;
  className?: string;
}) {
  const { open } = useDemoModal();
  return (
    <button
      type="button"
      onClick={open}
      className={`inline-flex items-center justify-center gap-2 rounded-xl bg-amber font-bold text-slate-deep shadow-[0_8px_30px_-8px_rgba(245,158,11,0.6)] transition-all hover:-translate-y-0.5 hover:bg-amber-hi active:translate-y-0 ${className}`}
    >
      {children}
    </button>
  );
}
