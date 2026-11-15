import Link from "next/link";
import { Logo } from "@/components/Logo";
import { Alert } from "@/components/ui";
import { isSupabaseConfigured } from "@/lib/env";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <Link href="/" className="mb-8">
        <Logo className="text-lg text-slate-900" />
      </Link>
      <div className="card w-full max-w-md p-6 sm:p-8">
        {!isSupabaseConfigured() && (
          <div className="mb-4">
            <Alert tone="warning">
              Supabase is not configured. Copy <code>.env.example</code> to <code>.env.local</code> and add your project keys (see README).
            </Alert>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
