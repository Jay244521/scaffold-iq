import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/landing/Logo";

export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle: string; children: ReactNode; footer: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-line">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-8">
          <Link href="/" aria-label="ApexField AI home">
            <Logo size="sm" />
          </Link>
          <Link href="/demo" className="text-sm font-medium text-slate-300 hover:text-amber">
            Live Simulator
          </Link>
        </div>
      </header>
      <main className="flex flex-1 items-start justify-center px-4 py-10 sm:items-center sm:py-16">
        <div className="w-full max-w-md">
          <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
          <p className="mt-1 text-sm text-muted">{subtitle}</p>
          <div className="mt-6 rounded-2xl border border-line bg-steel p-5 sm:p-6">{children}</div>
          <p className="mt-5 text-center text-sm text-muted">{footer}</p>
        </div>
      </main>
    </div>
  );
}

export function Field({
  label,
  hint,
  ...input
}: { label: string; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-slate-200">{label}</span>
      <input
        {...input}
        className="h-12 rounded-xl border border-line-strong bg-slate-deep px-3 text-base text-ink placeholder:text-muted focus:border-amber focus:outline-none"
      />
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-xl border border-danger/50 bg-danger/10 px-3 py-2.5 text-sm text-red-200">
      {message}
    </p>
  );
}

export const submitClass =
  "inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-amber px-5 text-base font-bold text-slate-deep transition-colors hover:bg-amber-hi disabled:cursor-not-allowed disabled:opacity-60";
