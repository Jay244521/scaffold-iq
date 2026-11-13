import { SearchX } from "lucide-react";
import type { Technician } from "@/lib/mock-fleet-data";
import { TechCard } from "./TechCard";

export function TechnicianGrid({ techs, onInspect, onReset }: { techs: Technician[]; onInspect: (id: string) => void; onReset: () => void }) {
  if (techs.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line-strong p-10 text-center">
        <SearchX className="h-8 w-8 text-muted" aria-hidden="true" />
        <p className="text-sm text-slate-300">No technicians match this filter.</p>
        <button type="button" onClick={onReset} className="min-h-11 rounded-lg border border-line-strong px-4 text-sm font-semibold hover:border-amber hover:text-amber">
          Show all techs
        </button>
      </div>
    );
  }
  return (
    <section aria-label="Technicians" className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {techs.map((t) => (
        <TechCard key={t.id} tech={t} onInspect={onInspect} />
      ))}
    </section>
  );
}
