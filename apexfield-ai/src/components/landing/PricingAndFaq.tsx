"use client";

import { useId, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { SectionHeading } from "./SectionHeading";
import { useDemoModal } from "./DemoModal";

type Tier = {
  name: string;
  price: string;
  unit?: string;
  seats: string;
  features: string[];
  cta: string;
  featured?: boolean;
};

const TIERS: Tier[] = [
  {
    name: "Pilot",
    price: "$149",
    unit: "/ tech / mo",
    seats: "Up to 5 Technicians",
    features: ["Unlimited diagnostic sessions", "OEM data-plate OCR", "Hands-free voice guidance", "FSM text export"],
    cta: "Start a Pilot",
  },
  {
    name: "Growth Fleet",
    price: "$119",
    unit: "/ tech / mo",
    seats: "6–25 Technicians",
    features: [
      "Everything in Pilot",
      "Service Manager dashboard",
      "Callback analytics",
      "Custom SOP injection",
      "Priority support",
    ],
    cta: "Book a Live Field Demo",
    featured: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    seats: "25+ Technicians",
    features: [
      "Direct ServiceTitan / Housecall Pro API sync",
      "Bluetooth Fieldpiece / Testo manifold telemetry",
      "Custom OEM library ingestion",
      "Dedicated onboarding",
    ],
    cta: "Talk to Sales",
  },
];

const FAQS: { q: string; a: string }[] = [
  {
    q: "Does it work in basements with poor cell service?",
    a: "Yes. ApexField uses edge frame compression and offline-tolerant state caching. Once the data plate is scanned, the OEM charging chart, wiring diagram and diagnostic sequence are held in the session, so a dead spot in a mechanical room doesn't stall the job.",
  },
  {
    q: "Do we have to buy expensive smart glasses?",
    a: "No. Zero proprietary hardware. It runs on the iOS and Android phones your techs already carry, with standard AirPods or any Bluetooth headset. A chest mount keeps the camera on the work and both hands free.",
  },
  {
    q: "Which HVAC brands and equipment types are supported?",
    a: "ApexField reads the OEM data plate on condensers, air handlers and furnaces, identifies manufacturer, model, serial, refrigerant (R-410A, R-454B, R-32, R-22) and tonnage, and loads that exact unit's documentation. Enterprise fleets can add custom OEM library ingestion for specialty or commercial equipment.",
  },
  {
    q: "How does it prevent bad electrical advice?",
    a: "Diagnostics run on deterministic OEM decision trees, not open-ended guessing. Before any 240V or 480V step, the vision model verifies the disconnect is pulled and meter probes are placed on the right scale. If something's unsafe, it interrupts by voice immediately.",
  },
  {
    q: "How fast can we onboard a new apprentice?",
    a: "Install the app, pair a headset, and they can run a coached session on their next service call. With live AI coaching, fleets see a 70%+ reduction in the time it takes a junior tech to be ready for a solo truck.",
  },
];

export function PricingAndFaq() {
  const { open } = useDemoModal();
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const baseId = useId();

  return (
    <section id="pricing" aria-labelledby="pricing-heading" className="border-t border-line bg-[#0E1320]">
      <div className="mx-auto max-w-7xl px-5 py-24 sm:px-8 lg:py-32">
        <SectionHeading id="pricing-heading" eyebrow="PRICING" title="Priced per tech. Paid back in callbacks." align="center">
          One avoided second-truck dispatch covers a tech&apos;s seat for the month.
        </SectionHeading>

        <div className="mt-14 grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-stretch">
          {TIERS.map((t) => (
            <article
              key={t.name}
              className={`relative flex flex-col gap-6 rounded-3xl bg-steel p-7 sm:p-8 ${
                t.featured
                  ? "border-2 border-amber shadow-[0_30px_80px_-30px_rgba(245,158,11,0.45)] lg:-my-3 lg:py-11"
                  : "border border-line"
              }`}
            >
              {t.featured && (
                <span className="absolute -top-3.5 left-8 rounded-full bg-gradient-to-r from-amber to-gauge px-3 py-1 font-mono text-[11px] font-bold tracking-[0.08em] text-slate-deep">
                  MOST POPULAR
                </span>
              )}
              <div>
                <h3 className="text-xl font-bold">{t.name}</h3>
                <p className="mt-1 text-sm text-muted">{t.seats}</p>
              </div>
              <p className="flex items-baseline gap-2">
                <span className={`font-mono text-5xl font-bold tracking-tight ${t.featured ? "text-amber" : "text-ink"}`}>
                  {t.price}
                </span>
                {t.unit && <span className="text-[15px] text-muted">{t.unit}</span>}
              </p>
              <ul className="flex flex-1 flex-col gap-3 text-[15px] text-slate-300">
                {t.features.map((f) => (
                  <li key={f} className="flex gap-3">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald" strokeWidth={3} aria-hidden="true" />
                    {f}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={open}
                className={`inline-flex min-h-12 items-center justify-center rounded-xl px-6 font-bold transition-all ${
                  t.featured
                    ? "bg-amber text-slate-deep hover:bg-amber-hi"
                    : "border border-line-strong text-ink hover:border-amber hover:text-amber"
                }`}
              >
                {t.cta}
              </button>
            </article>
          ))}
        </div>

        {/* FAQ */}
        <div className="mx-auto mt-28 max-w-3xl">
          <h2 className="text-center text-3xl font-extrabold tracking-tight sm:text-4xl">Questions from the field</h2>
          <div className="mt-10 flex flex-col gap-3">
            {FAQS.map((f, i) => {
              const isOpen = openFaq === i;
              const btnId = `${baseId}-faq-btn-${i}`;
              const panelId = `${baseId}-faq-panel-${i}`;
              return (
                <div
                  key={f.q}
                  className={`rounded-2xl border bg-steel transition-colors ${isOpen ? "border-amber/50" : "border-line"}`}
                >
                  <h3>
                    <button
                      id={btnId}
                      type="button"
                      aria-expanded={isOpen}
                      aria-controls={panelId}
                      onClick={() => setOpenFaq(isOpen ? null : i)}
                      className="flex min-h-16 w-full items-center justify-between gap-4 px-5 py-4 text-left text-base font-semibold sm:px-6"
                    >
                      {f.q}
                      <ChevronDown
                        className={`h-5 w-5 shrink-0 text-amber transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                        aria-hidden="true"
                      />
                    </button>
                  </h3>
                  <div
                    id={panelId}
                    role="region"
                    aria-labelledby={btnId}
                    className={`grid transition-[grid-template-rows] duration-300 ease-out ${isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
                  >
                    <div className="overflow-hidden">
                      <p className="px-5 pb-5 text-[15px] leading-relaxed text-muted sm:px-6">{f.a}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
