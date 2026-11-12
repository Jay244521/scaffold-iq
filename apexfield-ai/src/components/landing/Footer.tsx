import { MapPin } from "lucide-react";
import { Logo } from "./Logo";
import { NAV_LINKS } from "./navLinks";
import { DemoButton } from "./DemoModal";

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-line bg-[#080B13]">
      {/* Final CTA band */}
      <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8">
        <div className="relative overflow-hidden rounded-3xl border border-line bg-steel p-8 sm:p-12">
          <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-amber/15 blur-3xl" />
          <div className="relative flex flex-col items-start gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <h2 className="text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
                Put a 6-month apprentice in a truck. Get 5-year veteran diagnostics on day one.
              </h2>
              <p className="mt-3 text-lg text-muted">We&apos;ll walk a real unit with your team: scan, diagnose, verify, log.</p>
            </div>
            <DemoButton className="min-h-13 shrink-0 px-7 py-3.5 text-base">Book a Live Field Demo</DemoButton>
          </div>
        </div>
      </div>

      <div className="mx-auto flex max-w-7xl flex-col gap-10 border-t border-line px-5 py-12 sm:px-8 md:flex-row md:items-start md:justify-between">
        <div className="flex max-w-sm flex-col gap-4">
          <Logo size="sm" />
          <p className="text-sm leading-relaxed text-muted">Every Technician, A Master Technician.</p>
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-line bg-steel px-3.5 py-2 font-mono text-xs tracking-wide text-slate-300">
            <MapPin className="h-3.5 w-3.5 text-amber" aria-hidden="true" />
            Dallas-Fort Worth Metroplex, TX
          </span>
        </div>

        <nav aria-label="Footer">
          <p className="mb-4 font-mono text-xs tracking-[0.1em] text-muted">PRODUCT</p>
          <ul className="grid grid-cols-2 gap-x-10 gap-y-3 text-sm">
            {NAV_LINKS.map((l) => (
              <li key={l.href}>
                <a href={l.href} className="text-slate-300 transition-colors hover:text-amber">
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <div className="border-t border-line">
        <p className="mx-auto max-w-7xl px-5 py-6 text-xs text-muted sm:px-8">
          © {year} ApexField AI. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
