"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { AccountMenu } from "@/components/auth/AccountMenu";
import { FleetDashboard } from "./FleetDashboard";
import { LiveFleetDashboard } from "./LiveFleetDashboard";

type Mode = "live" | "demo";

/**
 * /dashboard: signed-in service managers get their live fleet (with a switch to the
 * demo board); everyone else sees the demo board with a sign-in prompt.
 */
export function DashboardShell() {
  const auth = useAuth();
  const canLive = auth.status === "signed_in" && auth.isManager && auth.profile !== null && auth.supabase !== null;
  const [mode, setMode] = useState<Mode>("demo");
  useEffect(() => {
    if (canLive) setMode((m) => (m === "demo" ? "live" : m));
  }, [canLive]);

  const account = <AccountMenu auth={auth} next="/dashboard" />;

  if (canLive && auth.status === "signed_in" && auth.profile && auth.supabase) {
    const toggle = (
      <div role="radiogroup" aria-label="Board" className="inline-flex self-start rounded-xl border border-line bg-steel p-1">
        {(["live", "demo"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={mode === m}
            onClick={() => setMode(m)}
            className={`min-h-10 rounded-lg px-4 text-sm font-semibold ${mode === m ? "bg-amber text-slate-deep" : "text-slate-300 hover:text-amber"}`}
          >
            {m === "live" ? "Live fleet" : "Demo data"}
          </button>
        ))}
      </div>
    );
    return mode === "live" ? (
      <LiveFleetDashboard sb={auth.supabase} profile={auth.profile} userId={auth.user.id} account={account} banner={toggle} />
    ) : (
      <FleetDashboard account={account} banner={toggle} />
    );
  }

  const banner =
    auth.status === "signed_in" && !auth.isManager ? (
      <p className="rounded-xl border border-line bg-steel px-4 py-3 text-sm text-slate-300">
        You&apos;re signed in as a technician, so this is demo data. The live fleet is for service managers.{" "}
        <Link href="/demo?mode=live" className="font-semibold text-amber hover:text-amber-hi">Start a live session →</Link>
      </p>
    ) : auth.status === "signed_out" ? (
      <p className="rounded-xl border border-amber/40 bg-amber/10 px-4 py-3 text-sm text-amber-hi">
        Demo data. <Link href="/login?next=%2Fdashboard" className="font-semibold underline">Sign in</Link> as a service manager to see your real fleet, or{" "}
        <Link href="/signup" className="font-semibold underline">create a company account</Link>.
      </p>
    ) : null;
  return <FleetDashboard account={account} banner={banner} />;
}
