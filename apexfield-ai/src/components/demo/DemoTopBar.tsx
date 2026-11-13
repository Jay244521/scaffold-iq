import Link from "next/link";
import { ArrowLeft, LayoutDashboard, RotateCcw } from "lucide-react";
import { Logo } from "@/components/landing/Logo";

export function DemoTopBar({
  onReset,
  canReset,
  resetLabel = "Reset Simulation",
}: {
  onReset: () => void;
  canReset: boolean;
  resetLabel?: string;
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-slate-deep/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-8">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-medium text-slate-300 transition-colors hover:text-amber"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">Back to Overview</span>
          <span className="sm:hidden">Back</span>
        </Link>
        <div className="hidden md:block">
          <Logo size="sm" />
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard"
            className="hidden min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-slate-400 transition-colors hover:text-amber sm:inline-flex"
          >
            <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
            Fleet Dashboard
          </Link>
          <button
            type="button"
            onClick={onReset}
            disabled={!canReset}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-line-strong px-4 text-sm font-semibold text-ink transition-colors hover:border-amber hover:text-amber disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-line-strong disabled:hover:text-ink"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            {resetLabel}
          </button>
        </div>
      </div>
    </header>
  );
}
