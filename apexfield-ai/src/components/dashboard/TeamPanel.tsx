"use client";

import { useEffect, useRef, useState } from "react";
import { KeyRound, Loader2, Pencil, UserCheck, UserPlus, UserX, Users, X } from "lucide-react";
import type { DbTechnician } from "@/lib/live-fleet";
import { experienceLabel } from "./fleet-ui";

const ROLE_LABEL: Record<string, string> = { apprentice: "Apprentice", tech: "Technician", lead_tech: "Lead tech (manager)", admin: "Admin (manager)" };

/** Manager-only modal: roster plus "add a technician" form (POST /api/team). */
export function TeamPanel({
  techs,
  meId,
  meRole,
  onClose,
  onAdded,
  onChanged,
}: {
  techs: DbTechnician[];
  meId: string;
  meRole: string;
  onClose: () => void;
  onAdded: (name: string) => void;
  onChanged: (message: string) => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
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
            <li key={t.id} className={`px-3 py-2.5 text-sm ${t.deactivated_at ? "opacity-60" : ""}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-ink">
                  {t.full_name}
                  {t.id === meId && <span className="ml-1.5 text-xs text-muted">(you)</span>}
                  {t.deactivated_at && <span className="ml-1.5 rounded bg-line px-1.5 py-0.5 font-mono text-[10px] text-muted">DEACTIVATED</span>}
                </span>
                <span className="flex flex-wrap items-center gap-2 font-mono text-[11px] text-muted">
                  {t.truck_label && <span className="text-amber">{t.truck_label}</span>}
                  <span>{ROLE_LABEL[t.role] ?? t.role}</span>
                  <span>{experienceLabel({ role: t.role === "apprentice" ? "Apprentice" : "Tech", experienceMonths: (t.experience_years ?? 0) * 12 })}</span>
                  {t.email && <span className="hidden sm:inline">{t.email}</span>}
                  {!(meRole === "lead_tech" && t.role === "admin") && (
                    <button
                      type="button"
                      onClick={() => setEditing(editing === t.id ? null : t.id)}
                      aria-expanded={editing === t.id}
                      className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-line-strong px-2 font-sans text-xs font-semibold text-slate-200 hover:border-amber hover:text-amber"
                    >
                      <Pencil className="h-3.5 w-3.5" aria-hidden="true" /> Manage
                    </button>
                  )}
                </span>
              </div>
              {editing === t.id && <MemberEditor member={t} self={t.id === meId} onDone={(msg) => { setEditing(null); onChanged(msg); }} />}
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

async function patchMember(id: string, body: Record<string, unknown>): Promise<string | null> {
  const res = await fetch(`/api/team/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (res.ok) return null;
  const j = (await res.json().catch(() => ({}))) as { error?: string };
  return j.error ?? "Something went wrong.";
}

/** Inline editor for one team member: details, password reset, deactivate/reactivate. */
function MemberEditor({ member, self, onDone }: { member: DbTechnician; self: boolean; onDone: (message: string) => void }) {
  const [role, setRole] = useState(member.role);
  const [truck, setTruck] = useState(member.truck_label ?? "");
  const [years, setYears] = useState(String(member.experience_years ?? 0));
  const [password, setPassword] = useState("");
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const input = "h-10 w-full rounded-lg border border-line-strong bg-slate-deep px-2.5 text-sm text-ink focus:border-amber focus:outline-none";
  const canChangeRole = !self && member.role !== "admin";

  const run = async (key: string, body: Record<string, unknown>, success: string) => {
    setBusy(key);
    setError(null);
    const err = await patchMember(member.id, body);
    setBusy(null);
    if (err) setError(err);
    else onDone(success);
  };

  return (
    <div className="mt-3 flex flex-col gap-3 rounded-xl border border-line bg-slate-deep/60 p-3">
      <div className="grid gap-2 sm:grid-cols-3">
        <label className="text-xs text-muted">
          Role
          <select className={input} value={role} disabled={!canChangeRole} onChange={(e) => setRole(e.target.value)}>
            {member.role === "admin" && <option value="admin">Admin (manager)</option>}
            <option value="apprentice">Apprentice</option>
            <option value="tech">Technician</option>
            <option value="lead_tech">Lead tech (can see the fleet)</option>
          </select>
        </label>
        <label className="text-xs text-muted">Truck<input className={input} value={truck} maxLength={24} onChange={(e) => setTruck(e.target.value)} /></label>
        <label className="text-xs text-muted">Years<input className={input} type="number" min={0} max={50} value={years} onChange={(e) => setYears(e.target.value)} /></label>
      </div>
      <button
        type="button"
        disabled={busy !== null}
        onClick={() => void run("save", { action: "update", ...(canChangeRole && role !== member.role ? { role } : {}), truckLabel: truck, experienceYears: years }, `${member.full_name} updated.`)}
        className="inline-flex min-h-10 items-center gap-2 self-start rounded-lg bg-amber px-3 text-sm font-bold text-slate-deep hover:bg-amber-hi disabled:opacity-60"
      >
        {busy === "save" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />} Save details
      </button>

      <div className="flex flex-wrap items-end gap-2 border-t border-line pt-3">
        <label className="min-w-0 flex-1 text-xs text-muted">
          New temporary password
          <input className={input} type="text" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="8+ characters" />
        </label>
        <button
          type="button"
          disabled={busy !== null || password.length < 8}
          onClick={() => void run("reset", { action: "reset_password", password }, `Password reset for ${member.full_name}. Share it privately.`)}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-line-strong px-3 text-sm font-semibold hover:border-amber hover:text-amber disabled:opacity-50"
        >
          <KeyRound className="h-4 w-4" aria-hidden="true" /> Reset password
        </button>
      </div>

      {!self && (
        <div className="border-t border-line pt-3">
          {member.deactivated_at ? (
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void run("reactivate", { action: "reactivate" }, `${member.full_name} can sign in again.`)}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-emerald/60 px-3 text-sm font-semibold text-emerald hover:bg-emerald/10 disabled:opacity-50"
            >
              <UserCheck className="h-4 w-4" aria-hidden="true" /> Reactivate
            </button>
          ) : confirmDeactivate ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-red-200">They&apos;ll be signed out of live sessions and can&apos;t sign in. Their history stays.</span>
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void run("deactivate", { action: "deactivate" }, `${member.full_name} was deactivated.`)}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-danger px-3 text-sm font-bold text-white disabled:opacity-50"
              >
                Yes, deactivate
              </button>
              <button type="button" onClick={() => setConfirmDeactivate(false)} className="min-h-10 rounded-lg px-3 text-sm text-muted hover:text-ink">
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDeactivate(true)}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-danger/50 px-3 text-sm font-semibold text-red-300 hover:bg-danger/10"
            >
              <UserX className="h-4 w-4" aria-hidden="true" /> Deactivate
            </button>
          )}
        </div>
      )}
      {error && <p role="alert" className="rounded-lg border border-danger/50 bg-danger/10 px-3 py-2 text-sm text-red-200">{error}</p>}
    </div>
  );
}
