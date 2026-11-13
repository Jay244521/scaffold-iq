"use client";

import Link from "next/link";
import { LogIn, LogOut, UserRound } from "lucide-react";
import type { useAuth } from "@/hooks/useAuth";

type Auth = ReturnType<typeof useAuth>;

/** Compact signed-in indicator with sign-out, or a sign-in link. */
export function AccountMenu({ auth, next }: { auth: Auth; next: string }) {
  if (auth.status === "unconfigured" || auth.status === "loading") return null;
  if (auth.status === "signed_out") {
    return (
      <Link
        href={`/login?next=${encodeURIComponent(next)}`}
        className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-line-strong px-3 text-sm font-semibold text-ink hover:border-amber hover:text-amber"
      >
        <LogIn className="h-4 w-4" aria-hidden="true" /> <span className="hidden sm:inline">Sign in</span>
      </Link>
    );
  }
  const p = auth.profile;
  return (
    <div className="flex items-center gap-2">
      <span className="hidden max-w-[14rem] items-center gap-1.5 truncate text-sm text-slate-300 lg:inline-flex" title={auth.user.email ?? ""}>
        <UserRound className="h-4 w-4 shrink-0 text-amber" aria-hidden="true" />
        <span className="truncate">
          {p?.full_name ?? auth.user.email}
          {p?.org_name ? <span className="text-muted"> · {p.org_name}</span> : null}
        </span>
      </span>
      <button
        type="button"
        onClick={() => void auth.signOut().then(() => window.location.assign("/"))}
        aria-label="Sign out"
        className="inline-flex min-h-11 items-center gap-2 rounded-lg px-2.5 text-sm font-medium text-slate-400 hover:text-amber"
      >
        <LogOut className="h-4 w-4" aria-hidden="true" />
        <span className="hidden sm:inline">Sign out</span>
      </button>
    </div>
  );
}
