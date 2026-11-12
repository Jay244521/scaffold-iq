import { Radar } from "lucide-react";

export function Logo({ size = "md" }: { size?: "sm" | "md" }) {
  const badge = size === "sm" ? "h-8 w-8" : "h-9 w-9";
  const icon = size === "sm" ? "h-4 w-4" : "h-5 w-5";
  const text = size === "sm" ? "text-base" : "text-lg";
  return (
    <span className="flex items-center gap-2.5">
      <span
        className={`${badge} flex items-center justify-center rounded-lg border border-amber/40 bg-gradient-to-br from-amber/25 to-gauge/10`}
      >
        <Radar className={`${icon} text-amber`} strokeWidth={2.25} aria-hidden="true" />
      </span>
      <span className={`${text} font-extrabold tracking-tight text-ink`}>
        ApexField <span className="text-amber">AI</span>
      </span>
    </span>
  );
}
