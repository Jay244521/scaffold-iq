"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { BarChart3, Building2, ClipboardList, LayoutDashboard, Menu, PackageSearch, Plus, Users, X } from "lucide-react";
import { cx } from "@/components/ui";

const items = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/incidents", label: "Incidents", icon: ClipboardList },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/inventory", label: "Inventory", icon: PackageSearch },
];
const settings = [
  { href: "/settings/facilities", label: "Facilities", icon: Building2 },
  { href: "/settings/team", label: "Team", icon: Users },
];

function NavLinks({ canReport, onNavigate }: { canReport: boolean; onNavigate?: () => void }) {
  const path = usePathname();
  const active = (href: string) => path === href || (path.startsWith(`${href}/`) && !(href === "/incidents" && path === "/incidents/new"));
  const link = (i: (typeof items)[number] & { soon?: boolean }) =>
    i.soon ? (
      <span key={i.href} className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-slate-400" title="Coming in a later phase">
        <i.icon className="h-4 w-4" aria-hidden />
        {i.label}
        <span className="ml-auto rounded bg-white/10 px-1.5 text-[10px] uppercase tracking-wide">Soon</span>
      </span>
    ) : (
      <Link
        key={i.href}
        href={i.href}
        onClick={onNavigate}
        aria-current={active(i.href) ? "page" : undefined}
        className={cx(
          "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium",
          active(i.href) ? "bg-white/15 text-white" : "text-slate-300 hover:bg-white/10 hover:text-white",
        )}
      >
        <i.icon className="h-4 w-4" aria-hidden />
        {i.label}
      </Link>
    );
  return (
    <nav className="flex flex-col gap-1" aria-label="Main">
      {canReport && (
        <Link
          href="/incidents/new"
          onClick={onNavigate}
          className="mb-3 flex items-center justify-center gap-2 rounded-md bg-amber-500 px-3 py-2.5 text-sm font-semibold text-slate-950 hover:bg-amber-400"
        >
          <Plus className="h-4 w-4" aria-hidden /> Report exception
        </Link>
      )}
      {items.map(link)}
      <p className="mb-1 mt-5 px-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Settings</p>
      {settings.map(link)}
    </nav>
  );
}

export function Sidebar({ canReport, header, footer }: { canReport: boolean; header: React.ReactNode; footer: React.ReactNode }) {
  return (
    <aside className="hidden w-64 shrink-0 flex-col bg-brand-900 px-3 py-4 lg:flex">
      <div className="mb-6 px-2">{header}</div>
      <div className="flex-1">
        <NavLinks canReport={canReport} />
      </div>
      <div className="border-t border-white/10 pt-3">{footer}</div>
    </aside>
  );
}

export function MobileNav({ canReport, header, footer }: { canReport: boolean; header: React.ReactNode; footer: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  useEffect(() => setOpen(false), [path]);
  return (
    <div className="lg:hidden">
      <div className="flex items-center justify-between bg-brand-900 px-4 py-3">
        {header}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="mobile-nav"
          className="rounded-md p-2 text-white hover:bg-white/10"
        >
          {open ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
          <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
        </button>
      </div>
      {open && (
        <div id="mobile-nav" className="bg-brand-900 px-3 pb-4">
          <NavLinks canReport={canReport} onNavigate={() => setOpen(false)} />
          <div className="mt-4 border-t border-white/10 pt-3">{footer}</div>
        </div>
      )}
    </div>
  );
}
