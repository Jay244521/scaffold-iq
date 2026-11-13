"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Home, PlayCircle, Radio } from "lucide-react";
import { Logo } from "@/components/landing/Logo";

export function DashboardTopBar() {
  // Rendered only after mount so server and client markup match.
  const [now, setNow] = useState<string | null>(null);
  useEffect(() => {
    const fmt = () => new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" });
    setNow(fmt());
    const id = setInterval(() => setNow(fmt()), 15_000);
    return () => clearInterval(id);
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-slate-deep/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/" aria-label="ApexField AI home" className="shrink-0">
            <Logo size="sm" />
          </Link>
          <span className="hidden h-6 w-px bg-line-strong sm:block" aria-hidden="true" />
          <span className="hidden truncate font-mono text-[11px] tracking-[0.12em] text-muted sm:block">FLEET COMMAND · DFW DISPATCH</span>
        </div>
        <nav aria-label="Dashboard" className="flex items-center gap-1 sm:gap-2">
          {now && (
            <span className="mr-1 hidden items-center gap-1.5 font-mono text-xs text-slate-300 md:inline-flex">
              <Radio className="h-3.5 w-3.5 text-emerald" aria-hidden="true" />
              {now} CT
            </span>
          )}
          <Link href="/" className="inline-flex min-h-11 items-center gap-2 rounded-lg px-2.5 text-sm font-medium text-slate-300 hover:text-amber">
            <Home className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Overview</span>
          </Link>
          <Link
            href="/demo"
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-line-strong px-3 text-sm font-semibold text-ink hover:border-amber hover:text-amber"
          >
            <PlayCircle className="h-4 w-4 text-amber" aria-hidden="true" />
            <span className="hidden sm:inline">Live Simulator</span>
            <span className="sm:hidden">Simulator</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
