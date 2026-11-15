import { LinkButton } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <p className="font-mono text-sm text-slate-500">404</p>
      <h1 className="mt-2 text-xl font-semibold text-slate-900">Page not found</h1>
      <p className="mt-1 max-w-sm text-sm text-slate-600">It may have been removed, or you may not have access to it.</p>
      <LinkButton href="/dashboard" className="mt-6">
        Go to dashboard
      </LinkButton>
    </div>
  );
}
