"use client";

import { useState } from "react";
import Link from "next/link";
import { KeyRound, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { validatePassword } from "@/lib/auth/validate";
import { AuthShell, Field, FormError, submitClass } from "@/components/auth/AuthShell";

const ROLE_LABEL: Record<string, string> = { apprentice: "Apprentice", tech: "Technician", lead_tech: "Lead tech", admin: "Admin (service manager)" };

/** Profile summary + change your own password (e.g. replace the temporary one your manager set). */
export function AccountForm() {
  const auth = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validatePassword(password) || (password !== confirm ? "The two passwords don't match." : null);
    if (err) return setError(err);
    if (!auth.supabase) return;
    setBusy(true);
    setError(null);
    const { error: updErr } = await auth.supabase.auth.updateUser({ password });
    setBusy(false);
    if (updErr) return setError(/same/i.test(updErr.message) ? "Pick a password different from your current one." : updErr.message);
    setDone(true);
    setPassword("");
    setConfirm("");
  };

  const home = auth.status === "signed_in" && auth.isManager ? "/dashboard" : "/demo?mode=live";

  return (
    <AuthShell
      title="Your account"
      subtitle={auth.status === "signed_in" ? (auth.user.email ?? "") : "Sign in to manage your account."}
      footer={
        <Link href={home} className="font-semibold text-amber hover:text-amber-hi">
          ← Back
        </Link>
      }
    >
      {auth.status === "loading" ? (
        <p className="flex items-center gap-2 text-sm text-muted"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading…</p>
      ) : auth.status !== "signed_in" ? (
        <Link href="/login?next=%2Faccount" className={submitClass}>Sign in</Link>
      ) : (
        <div className="flex flex-col gap-5">
          {auth.profile && (
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-lg border border-line bg-slate-deep p-2.5"><dt className="text-xs text-muted">Name</dt><dd className="text-ink">{auth.profile.full_name}</dd></div>
              <div className="rounded-lg border border-line bg-slate-deep p-2.5"><dt className="text-xs text-muted">Company</dt><dd className="text-ink">{auth.profile.org_name ?? "—"}</dd></div>
              <div className="rounded-lg border border-line bg-slate-deep p-2.5"><dt className="text-xs text-muted">Role</dt><dd className="text-ink">{ROLE_LABEL[auth.profile.role] ?? auth.profile.role}</dd></div>
              <div className="rounded-lg border border-line bg-slate-deep p-2.5"><dt className="text-xs text-muted">Truck</dt><dd className="font-mono text-ink">{auth.profile.truck_label ?? "—"}</dd></div>
            </dl>
          )}
          <form onSubmit={submit} className="flex flex-col gap-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-ink"><KeyRound className="h-4 w-4 text-amber" aria-hidden="true" /> Change password</p>
            <Field label="New password" type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} hint="At least 8 characters." />
            <Field label="Confirm new password" type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            <FormError message={error} />
            {done && <p role="status" className="rounded-xl border border-emerald/50 bg-emerald/10 px-3 py-2.5 text-sm text-emerald">Password updated.</p>}
            <button type="submit" disabled={busy} className={submitClass}>
              {busy && <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />} Update password
            </button>
          </form>
        </div>
      )}
    </AuthShell>
  );
}
