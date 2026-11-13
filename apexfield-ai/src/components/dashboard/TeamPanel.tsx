"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, UserPlus, Users, X } from "lucide-react";
import type { DbTechnician } from "@/lib/live-fleet";
import { experienceLabel } from "./fleet-ui";

const ROLE_LABEL: Record<string, string> = { apprentice: "Apprentice", tech: "Technician", lead_tech: "Lead tech (manager)", admin: "Admin (manager)" };

/** Manager-only modal: roster plus "add a technician" form (POST /api/team). */
export function TeamPanel({ techs, onClose, onAdded }: { techs: DbTechnician[]; onClose: () => void; onAdded: (name: string) => void }) {
  const [form, setForm] = useState({ fullName: "", email: "", password: "", role: "tech", experienceYears: "0", truckLabel: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/team", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!res.ok) return setError(body.error ?? "Could not add the technician.");
    onAdded(form.fullName);
    setForm({ fullName: "", email: "", password: "", role: "tech", experienceYears: "0", truckLabel: "" });
  };

  const input = "h-11 w-full rounded-lg border border-line-strong bg-slate-deep px-3 text-sm text-ink placeholder:text-muted focus:border-amber focus:outline-none";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="presentation">
      <div className="animate-fade-in absolute inset-0 bg-black/65" onClick={onClose} aria-hidden="true" />
      <div role="dialog" aria-modal="true" aria-labelledby="team-title" className="animate-fade-up relative max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl border border-line bg-steel p-5 sm:rounded-2xl sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <h2 id="team-title" className="flex items-center gap-2 text-lg font-extrabold">
            <Users className="h-5 w-5 text-amber" aria-hidden="true" /> Your team
          </h2>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close" className="flex h-11 w-11 items-center justify-center rounded-lg border border-line-strong text-slate-300 hover:text-amber">
            <X className="h-5 w-5" />
          </button>
        </div>

        <ul className="mt-4 divide-y divide-line rounded-xl border border-line">
          {techs.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm">
              <span className="font-medium text-ink">{t.full_name}</span>
              <span className="flex flex-wrap items-center gap-2 font-mono text-[11px] text-muted">
                {t.truck_label && <span className="text-amber">{t.truck_label}</span>}
                <span>{ROLE_LABEL[t.role] ?? t.role}</span>
                <span>{experienceLabel({ role: t.role === "apprentice" ? "Apprentice" : "Tech", experienceMonths: (t.experience_years ?? 0) * 12 })}</span>
                {t.email && <span className="hidden sm:inline">{t.email}</span>}
              </span>
            </li>
          ))}
        </ul>

        <form onSubmit={submit} className="mt-5 rounded-xl border border-line bg-slate-deep/60 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-ink">
            <UserPlus className="h-4 w-4 text-amber" aria-hidden="true" /> Add a technician
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-muted">Full name<input className={input} required value={form.fullName} onChange={set("fullName")} /></label>
            <label className="text-xs text-muted">Email<input className={input} type="email" required value={form.email} onChange={set("email")} /></label>
            <label className="text-xs text-muted">Temporary password<input className={input} type="text" minLength={8} required value={form.password} onChange={set("password")} placeholder="8+ characters, share it privately" /></label>
            <label className="text-xs text-muted">
              Role
              <select className={input} value={form.role} onChange={set("role")}>
                <option value="apprentice">Apprentice</option>
                <option value="tech">Technician</option>
                <option value="lead_tech">Lead tech (can see the fleet)</option>
              </select>
            </label>
            <label className="text-xs text-muted">Years of experience<input className={input} type="number" min={0} max={50} value={form.experienceYears} onChange={set("experienceYears")} /></label>
            <label className="text-xs text-muted">Truck<input className={input} value={form.truckLabel} onChange={set("truckLabel")} placeholder="TRUCK-04" maxLength={24} /></label>
          </div>
          {error && <p role="alert" className="mt-3 rounded-lg border border-danger/50 bg-danger/10 px-3 py-2 text-sm text-red-200">{error}</p>}
          <button type="submit" disabled={busy} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-amber px-4 text-sm font-bold text-slate-deep hover:bg-amber-hi disabled:opacity-60">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <UserPlus className="h-4 w-4" aria-hidden="true" />} Add technician
          </button>
          <p className="mt-2 text-xs text-muted">They sign in at /login with this email and password, then start Live AI sessions from their phone.</p>
        </form>
      </div>
    </div>
  );
}
