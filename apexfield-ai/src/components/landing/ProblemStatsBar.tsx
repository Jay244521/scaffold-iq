import { Clock, DollarSign, TrendingUp, type LucideIcon } from "lucide-react";

const STATS: { icon: LucideIcon; value: string; label: string }[] = [
  {
    icon: DollarSign,
    value: "$250–$450",
    label: "Average direct cost of a single second-truck dispatch or diagnostic callback.",
  },
  {
    icon: Clock,
    value: "2–5 Years",
    label: "Traditional apprenticeship timeline to independently troubleshoot VRF, heat pumps, and commercial RTUs.",
  },
  {
    icon: TrendingUp,
    value: "70%+ Faster",
    label: "Reduction in junior technician ramp-to-solo-truck readiness with live AI coaching.",
  },
];

export function ProblemStatsBar() {
  return (
    <section aria-labelledby="cost-heading" className="relative bg-gradient-to-r from-amber to-gauge text-slate-deep">
      <h2 id="cost-heading" className="sr-only">
        The cost of callbacks
      </h2>
      <div className="mx-auto grid max-w-7xl grid-cols-1 divide-y divide-slate-deep/15 px-5 sm:px-8 md:grid-cols-3 md:divide-x md:divide-y-0">
        {STATS.map(({ icon: Icon, value, label }) => (
          <div key={value} className="flex flex-col gap-2 py-8 md:px-8 md:py-10 md:first:pl-0 md:last:pr-0">
            <Icon className="h-6 w-6 opacity-80" strokeWidth={2.5} aria-hidden="true" />
            <p className="font-mono text-4xl font-bold tracking-tight lg:text-[2.6rem]">{value}</p>
            <p className="max-w-sm text-[15px] font-semibold leading-snug text-slate-deep/85">{label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
