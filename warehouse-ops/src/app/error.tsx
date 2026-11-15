"use client";

import { Button } from "@/components/ui";

/** Shown for unexpected errors. Never displays technical details to the user. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <h1 className="text-xl font-semibold text-slate-900">Something went wrong</h1>
      <p className="mt-1 max-w-sm text-sm text-slate-600">
        Please try again. If it keeps happening, contact support{error.digest ? ` with reference ${error.digest}` : ""}.
      </p>
      <Button onClick={reset} className="mt-6">
        Try again
      </Button>
    </div>
  );
}
