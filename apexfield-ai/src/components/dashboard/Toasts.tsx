"use client";

import { CheckCircle2, Truck, X } from "lucide-react";

export type Toast = { id: number; title: string; body: string; tone: "success" | "dispatch" };

/** Bottom-left so toasts never cover the right-hand inspector drawer or its controls. */
export function Toasts({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  return (
    <div aria-live="polite" className="pointer-events-none fixed bottom-4 left-4 right-4 z-[60] flex flex-col items-start gap-2 sm:right-auto sm:w-96">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className={`animate-fade-up pointer-events-auto flex w-full gap-3 rounded-xl border bg-steel-2 p-3.5 shadow-2xl ${
            t.tone === "dispatch" ? "border-amber/60" : "border-emerald/60"
          }`}
        >
          {t.tone === "dispatch" ? (
            <Truck className="h-5 w-5 shrink-0 text-amber" aria-hidden="true" />
          ) : (
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald" aria-hidden="true" />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-ink">{t.title}</p>
            <p className="mt-0.5 text-sm text-slate-300">{t.body}</p>
          </div>
          <button type="button" onClick={() => onDismiss(t.id)} aria-label="Dismiss notification" className="-m-1.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted hover:text-ink">
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
