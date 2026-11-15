import Link from "next/link";
import type { Metadata } from "next";
import { SignupForm } from "../AuthForms";

export const metadata: Metadata = { title: "Create account" };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <>
      <h1 className="text-xl font-semibold text-slate-900">Create your account</h1>
      <p className="mb-6 mt-1 text-sm text-slate-600">
        {next?.startsWith("/invite/") ? "Create an account to accept your team invitation." : "Set up your company workspace in a couple of minutes."}
      </p>
      <SignupForm next={next} />
      <p className="mt-6 text-center text-sm text-slate-600">
        Already have an account?{" "}
        <Link href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"} className="font-medium text-brand-600 hover:underline">
          Log in
        </Link>
      </p>
    </>
  );
}
