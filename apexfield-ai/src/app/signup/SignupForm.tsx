"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, Loader2 } from "lucide-react";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { validateEmail, validatePassword } from "@/lib/auth/validate";
import { AuthShell, Field, FormError, submitClass } from "@/components/auth/AuthShell";

export function SignupForm() {
  const router = useRouter();
  const sb = getBrowserSupabase();
  const [form, setForm] = useState({ companyName: "", fullName: "", email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sb) return;
    const local = validateEmail(form.email) || validatePassword(form.password);
    if (local) return setError(local);
    setBusy(true);
    setError(null);
    const res = await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setBusy(false);
      return setError(body.error ?? "Could not create the account.");
    }
    const { error: signInErr } = await sb.auth.signInWithPassword({ email: form.email.trim().toLowerCase(), password: form.password });
    if (signInErr) {
      setBusy(false);
      return setError("Account created. Sign in to continue.");
    }
    router.replace("/dashboard");
    router.refresh();
  };

  return (
    <AuthShell
      title="Create your company account"
      subtitle="You'll be the service manager. Add your technicians from the Fleet Dashboard."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-amber hover:text-amber-hi">
            Sign in
          </Link>
        </>
      }
    >
      {!sb ? (
        <FormError message="Accounts aren't configured on this site yet." />
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4">
          <Field label="Company name" autoComplete="organization" required value={form.companyName} onChange={set("companyName")} placeholder="Lone Star Heating & Air" />
          <Field label="Your name" autoComplete="name" required value={form.fullName} onChange={set("fullName")} />
          <Field label="Work email" type="email" autoComplete="email" required value={form.email} onChange={set("email")} />
          <Field label="Password" type="password" autoComplete="new-password" required minLength={8} value={form.password} onChange={set("password")} hint="At least 8 characters." />
          <FormError message={error} />
          <button type="submit" disabled={busy} className={submitClass}>
            {busy ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : <Building2 className="h-5 w-5" aria-hidden="true" />}
            Create account
          </button>
        </form>
      )}
    </AuthShell>
  );
}
