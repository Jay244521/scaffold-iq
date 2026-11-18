"use client";

import { useEffect, useRef, useState } from "react";
import { ShieldCheck, X } from "lucide-react";

const ITEMS = [
  "I've told the customer this visit uses an AI assistant that sees my phone camera and hears audio on site.",
  "AI guidance doesn't replace lockout/tagout, my training, local code, or the manufacturer's instructions. I stay responsible for the work.",
  "I'll pull the disconnect and verify 0V myself before touching anything electrical, whatever the AI says.",
] as const;

const key = (userId: string) => `apexfield.consent.${userId}`;
const today = () => new Date().toISOString().slice(0, 10);

/** True if this technician already acknowledged today on this device. */
export function hasAcknowledgedToday(userId: string | null): boolean {
  if (!userId) return false;
  try {
    return localStorage.getItem(key(userId)) === today();
  } catch {
    return false;
  }
}

function remember(userId: string) {
  try {
    localStorage.setItem(key(userId), today());
  } catch {
    /* private mode: ask again next time */
  }
}

/**
 * Daily customer-consent and safety acknowledgment before a live session.
 * The server also requires it (consent_acknowledged_at is stored on the session).
 */
export function ConsentGate({ userId, onConfirm, onCancel }: { userId: string; onConfirm: () => void; onCancel: () => void }) {
  const [checked, setChecked] = useState<boolean[]>(ITEMS.map(() => false));
  const firstRef = useRef<HTMLInputElement>(null);
  const all = checked.every(Boolean);

  useEffect(() => {
    firstRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="presentation">
      <div className="animate-fade-in absolute inset-0 bg-black/70" onClick={onCancel} aria-hidden="true" />
      <div role="dialog" aria-modal="true" aria-labelledby="consent-title" className="animate-fade-up relative w-full max-w-lg rounded-t-2xl border border-line bg-steel p-5 sm:rounded-2xl sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <h2 id="consent-title" className="flex items-center gap-2 text-lg font-extrabold">
            <ShieldCheck className="h-5 w-5 text-emerald" aria-hidden="true" /> Before you start
          </h2>
          <button type="button" onClick={onCancel} aria-label="Cancel" className="-m-2 flex h-11 w-11 items-center justify-center rounded-lg text-muted hover:text-ink">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mt-1 text-sm text-muted">Once a day, confirm:</p>
        <ul className="mt-4 flex flex-col gap-3">
          {ITEMS.map((text, i) => (
            <li key={i}>
              <label className="flex min-h-12 cursor-pointer items-start gap-3 rounded-xl border border-line bg-slate-deep p-3 text-sm text-slate-200">
                <input
                  ref={i === 0 ? firstRef : undefined}
                  type="checkbox"
                  checked={checked[i]}
                  onChange={(e) => setChecked((c) => c.map((v, j) => (j === i ? e.target.checked : v)))}
                  className="mt-0.5 h-5 w-5 shrink-0 accent-amber"
                />
                {text}
              </label>
            </li>
          ))}
        </ul>
        <button
          type="button"
          disabled={!all}
          onClick={() => {
            remember(userId);
            onConfirm();
          }}
          className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-amber px-5 text-base font-bold text-slate-deep hover:bg-amber-hi disabled:cursor-not-allowed disabled:bg-line-strong disabled:text-muted"
        >
          Start live session
        </button>
      </div>
    </div>
  );
}
