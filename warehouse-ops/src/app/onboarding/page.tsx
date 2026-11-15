import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Logo } from "@/components/Logo";
import { getAppContext, requireUser } from "@/lib/context";
import { logOut } from "@/app/(auth)/actions";
import { OnboardingForm } from "./OnboardingForm";

export const metadata: Metadata = { title: "Set up your workspace" };

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ new?: string }> }) {
  await requireUser("/onboarding");
  const ctx = await getAppContext();
  const { new: creatingAnother } = await searchParams;
  if (ctx && ctx.memberships.length > 0 && !creatingAnother) redirect("/dashboard");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <Logo className="mb-8 text-lg text-slate-900" />
      <div className="card w-full max-w-md p-6 sm:p-8">
        <h1 className="text-xl font-semibold text-slate-900">Set up your company workspace</h1>
        <p className="mb-6 mt-1 text-sm text-slate-600">
          You'll be the owner and can invite your team next. Joining an existing company instead? Ask its admin for an invitation link.
        </p>
        <OnboardingForm />
      </div>
      <div className="mt-6 flex gap-4 text-sm text-slate-600">
        {creatingAnother && <Link href="/dashboard" className="hover:underline">Back to dashboard</Link>}
        <form action={logOut}>
          <button className="hover:underline">Log out</button>
        </form>
      </div>
    </div>
  );
}
