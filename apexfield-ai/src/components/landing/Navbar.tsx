"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LayoutDashboard, Menu, PlayCircle, X } from "lucide-react";
import { Logo } from "./Logo";
import { DemoButton } from "./DemoModal";
import { NAV_LINKS } from "./navLinks";


export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 border-b backdrop-blur-xl transition-colors duration-300 ${
        scrolled ? "border-line bg-slate-deep/80" : "border-transparent bg-slate-deep/40"
      }`}
    >
      <nav aria-label="Primary" className="mx-auto flex h-[72px] max-w-7xl items-center justify-between gap-6 px-5 sm:px-8">
        <a href="#top" aria-label="ApexField AI home">
          <Logo />
        </a>

        <ul className="hidden items-center gap-8 text-[15px] font-medium lg:flex">
          {NAV_LINKS.map((l) => (
            <li key={l.href}>
              <a href={l.href} className="text-slate-300 transition-colors hover:text-amber">
                {l.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-2">
          <Link
            href="/dashboard"
            className="hidden min-h-11 items-center gap-1.5 rounded-xl px-2 text-sm font-medium text-slate-400 transition-colors hover:text-amber xl:inline-flex"
          >
            <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
            Fleet Dashboard
          </Link>
          <Link
            href="/demo"
            className="hidden min-h-11 items-center gap-2 rounded-xl border border-line-strong px-4 text-sm font-semibold text-ink transition-colors hover:border-amber hover:text-amber lg:inline-flex"
          >
            <PlayCircle className="h-4 w-4 text-amber" aria-hidden="true" />
            Live Simulator
          </Link>
          <DemoButton className="hidden min-h-11 px-5 text-sm sm:inline-flex">Book a Live Field Demo</DemoButton>
          <button
            type="button"
            onClick={() => setMobileOpen((o) => !o)}
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            className="flex h-11 w-11 items-center justify-center rounded-lg border border-line text-ink lg:hidden"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </nav>

      {mobileOpen && (
        <div id="mobile-nav" className="animate-fade-up border-t border-line bg-slate-deep/95 px-5 pb-6 pt-2 lg:hidden">
          <ul className="flex flex-col">
            {NAV_LINKS.map((l) => (
              <li key={l.href}>
                <a
                  href={l.href}
                  onClick={() => setMobileOpen(false)}
                  className="flex min-h-12 items-center border-b border-line text-base font-medium text-slate-200"
                >
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
          <Link
            href="/demo"
            onClick={() => setMobileOpen(false)}
            className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-line-strong px-5 text-base font-semibold text-ink"
          >
            <PlayCircle className="h-5 w-5 text-amber" aria-hidden="true" />
            Live Simulator
          </Link>
          <Link
            href="/dashboard"
            onClick={() => setMobileOpen(false)}
            className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-line px-5 text-base font-medium text-slate-300"
          >
            <LayoutDashboard className="h-5 w-5" aria-hidden="true" />
            Fleet Dashboard
          </Link>
          <DemoButton className="mt-3 min-h-12 w-full px-5 text-base">Book a Live Field Demo</DemoButton>
        </div>
      )}
    </header>
  );
}
