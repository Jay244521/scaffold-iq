"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, LogIn } from "lucide-react";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { isManagerRole, safeNext } from "@/lib/supabase/config";
import { AuthShell, Field, FormError, submitClass } from "@/components/auth/AuthShell";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sb = getBrowserSupabase();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sb) return;
    setBusy(true);
    setError(null);
    const { data, error: err } = await sb.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    if (err || !data.user) {
      setBusy(false);
      setError(err?.message === "Invalid login credentials" ? "Wrong email or password." : (err?.message ?? "Sign-in failed."));
      return;
    }
    // Managers land on the fleet board, techs on the live coach, unless a page asked to come back.
    const { data: tech } = await sb.from("technicians").select("role").eq("id", data.user.id).maybeSingle();
    const fallback = isManagerRole((tech as { role?: string } | null)?.role) ? "/dashboard" : "/demo?mode=live";
    router.replace(safeNext(params.get("next"), fallback));
    router.refresh();
  };

  return (
    <AuthShell
      title="Sign in"
      subtitle="Technicians start live AI sessions. Service managers see the fleet."
      footer={
        <>
          New company?{" "}
          <Link href="/signup" className="font-semibold text-amber hover:text-amber-hi">
            Create an account
          </Link>
        </>
      }
    >
      {!sb ? (
        <FormError message="Sign-in isn't configured on this site yet (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)." />
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4">
          <Field label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <Field label="Password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          <FormError message={error} />
          <button type="submit" disabled={busy} className={submitClass}>
            {busy ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : <LogIn className="h-5 w-5" aria-hidden="true" />}
            Sign in
          </button>
          <p className="text-xs text-muted">Technician accounts are created by your service manager.</p>
        </form>
      )}
    </AuthShell>
  );
}
