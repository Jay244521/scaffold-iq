import { Headphones, ShieldCheck, SignalLow, Sun, type LucideIcon } from "lucide-react";
import { SectionHeading } from "./SectionHeading";

const CARDS: { icon: LucideIcon; title: string; body: string; spec: string; verified?: boolean }[] = [
  {
    icon: Sun,
    title: "Outdoor Sunlight High-Contrast UI",
    body: "Legible in 105°F direct glare on a commercial rooftop. Big type, hard contrast, nothing that washes out at high noon.",
    spec: "HIGH-CONTRAST · GLARE-READY",
  },
  {
    icon: SignalLow,
    title: "Weak Signal Resilience",
    body: "Edge frame compression and offline-tolerant state caching keep the session moving in basements, crawlspaces and mechanical rooms.",
    spec: "EDGE COMPRESSION · STATE CACHE",
  },
  {
    icon: Headphones,
    title: "100% Hands-Free Operation",
    body: "Works with chest-mounted smartphones and standard AirPods or Bluetooth headsets. Gloves stay on. Gauges stay in hand.",
    spec: "AIRPODS · BLUETOOTH · CHEST MOUNT",
  },
  {
    icon: ShieldCheck,
    title: "Zero-Hallucination State Machine",
    body: "Deterministic OEM diagnostic trees. It never guesses on 240V or 480V electrical circuits. If it can't verify, it stops the tech.",
    spec: "DETERMINISTIC · OEM-GROUNDED",
    verified: true,
  },
];

export function FieldBuiltSection() {
  return (
    <section id="safety" aria-labelledby="safety-heading" className="mx-auto max-w-7xl px-5 py-24 sm:px-8 lg:py-32">
      <SectionHeading id="safety-heading" eyebrow="SAFETY & ACCURACY" title="Engineered for rooftops, attics & basements.">
        Not a chatbot in a conference room. Built for 105°F rooftops, dead-signal basements and hands full of gauges and
        meter leads.
      </SectionHeading>

      <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {CARDS.map(({ icon: Icon, title, body, spec, verified }) => (
          <article
            key={title}
            className={`group flex flex-col gap-4 rounded-2xl border bg-steel p-6 transition-all duration-200 hover:-translate-y-1 ${
              verified ? "border-emerald/45 hover:border-emerald" : "border-line hover:border-amber/50"
            }`}
          >
            <span
              className={`flex h-12 w-12 items-center justify-center rounded-xl ${
                verified ? "bg-emerald/12 text-emerald" : "bg-amber/12 text-amber"
              }`}
            >
              <Icon className="h-6 w-6" aria-hidden="true" />
            </span>
            <h3 className="text-lg font-bold leading-snug">{title}</h3>
            <p className="flex-1 text-[15px] leading-relaxed text-muted">{body}</p>
            <p className={`font-mono text-[11px] tracking-[0.08em] ${verified ? "text-emerald" : "text-amber/90"}`}>{spec}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
