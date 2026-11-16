import Link from "next/link";
import { TrendingUp } from "lucide-react";
import { Card } from "@/components/ui";
import { EXCEPTION_LABELS, type ExceptionType } from "@/lib/labels";

export type Patterns = {
  supplier_trends: { supplier_id: string; supplier: string; type: ExceptionType; current: number; previous_avg: number }[];
  repeat_skus: { sku: string; count: number; suppliers: number; top_type: ExceptionType }[];
  stale_open: number;
};

/** Rules-based alerts (no AI): rising supplier issues, repeat SKUs, exceptions left open. */
export function PatternsCard({ p, className }: { p: Patterns | null; className?: string }) {
  const items: { key: string; text: React.ReactNode; href: string; link: string }[] = [];
  for (const t of p?.supplier_trends ?? []) {
    items.push({
      key: `s-${t.supplier_id}-${t.type}`,
      text: (
        <>
          <strong>{t.supplier}</strong>: {t.current} {EXCEPTION_LABELS[t.type].toLowerCase()} exceptions in the last 30 days
          {Number(t.previous_avg) > 0 ? `, up from about ${t.previous_avg} a month before` : ", none in the previous two months"}.
        </>
      ),
      href: `/reports/supplier/${t.supplier_id}`,
      link: "Draft report",
    });
  }
  for (const s of p?.repeat_skus ?? []) {
    items.push({
      key: `k-${s.sku}`,
      text: (
        <>
          SKU <strong className="font-mono">{s.sku}</strong>: {s.count} exceptions in 30 days{s.suppliers > 1 ? ` across ${s.suppliers} suppliers` : ""}, mostly{" "}
          {EXCEPTION_LABELS[s.top_type].toLowerCase()}.
        </>
      ),
      href: `/incidents?q=${encodeURIComponent(s.sku)}`,
      link: "View",
    });
  }
  if ((p?.stale_open ?? 0) > 0) {
    items.push({
      key: "stale",
      text: (
        <>
          <strong>{p!.stale_open}</strong> exception{p!.stale_open === 1 ? " has" : "s have"} been open for more than a week.
        </>
      ),
      href: "/incidents?status=unresolved",
      link: "Review",
    });
  }
  return (
    <Card title="Patterns to watch" className={className}>
      {items.length === 0 ? (
        <p className="text-sm text-slate-500">No unusual patterns in the last 30 days.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((i) => (
            <li key={i.key} className="flex gap-2 text-sm">
              <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
              <span className="text-slate-800">
                {i.text}{" "}
                <Link href={i.href} className="whitespace-nowrap font-medium text-brand-600 hover:underline">{i.link}</Link>
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-xs text-slate-500">Flagged by simple rules: a supplier&apos;s exceptions doubling, repeat SKUs, or items left open.</p>
    </Card>
  );
}
