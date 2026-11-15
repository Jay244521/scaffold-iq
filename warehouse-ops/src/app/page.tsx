import Link from "next/link";
import { redirect } from "next/navigation";
import { ClipboardCheck, FileSearch, ShieldCheck, Truck } from "lucide-react";
import { Logo } from "@/components/Logo";
import { LinkButton } from "@/components/ui";
import { getUser } from "@/lib/context";

const features = [
  { icon: ClipboardCheck, title: "Log exceptions at the dock", body: "Shortages, overages, damage and wrong items captured in under a minute, with photos, from any phone." },
  { icon: Truck, title: "See supplier patterns", body: "Know which suppliers and lanes generate the most discrepancies, and how long they take to resolve." },
  { icon: FileSearch, title: "Track every incident to closure", body: "Assignment, status, internal comments, resolution notes and a complete history for every exception." },
  { icon: ShieldCheck, title: "Private by design", body: "Each company's data is isolated at the database level. Evidence files are never publicly accessible." },
];

export default async function Home() {
  if (await getUser()) redirect("/dashboard");
  return (
    <div className="min-h-screen bg-white">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Logo className="text-slate-900" />
        <nav className="flex items-center gap-2">
          <Link href="/login" className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
            Log in
          </Link>
          <LinkButton href="/signup">Get started</LinkButton>
        </nav>
      </header>
      <main>
        <section className="mx-auto max-w-6xl px-4 pb-16 pt-12 sm:px-6 sm:pt-20">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">Receiving exception management</p>
          <h1 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
            Every receiving discrepancy, documented and resolved.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-slate-600">
            Warehouse Ops gives independent warehouses, distributors, manufacturers and 3PLs one place to log, track and report
            receiving exceptions and inventory discrepancies — without replacing your WMS.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <LinkButton href="/signup" size="lg">
              Create your workspace
            </LinkButton>
            <LinkButton href="/login" variant="secondary" size="lg">
              Log in
            </LinkButton>
          </div>
        </section>
        <section className="border-t border-slate-200 bg-slate-50">
          <div className="mx-auto grid max-w-6xl gap-6 px-4 py-14 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
            {features.map(({ icon: Icon, title, body }) => (
              <div key={title}>
                <Icon className="h-6 w-6 text-brand-600" aria-hidden />
                <h2 className="mt-3 font-semibold text-slate-900">{title}</h2>
                <p className="mt-1 text-sm text-slate-600">{body}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
      <footer className="mx-auto max-w-6xl px-4 py-8 text-sm text-slate-500 sm:px-6">Warehouse Ops — early access</footer>
    </div>
  );
}
