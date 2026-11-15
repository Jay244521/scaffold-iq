import Link from "next/link";
import type { Metadata } from "next";
import { LoginForm } from "../AuthForms";

export const metadata: Metadata = { title: "Log in" };

const messages: Record<string, string> = {
  confirmed: "Your email is confirmed. Log in to continue.",
  "link-expired": "That link has expired or was already used. Log in, or request a new link.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; message?: string }> }) {
  const { next, message } = await searchParams;
  return (
    <>
      <h1 className="text-xl font-semibold text-slate-900">Log in</h1>
      <p className="mb-6 mt-1 text-sm text-slate-600">Welcome back. Enter your details to continue.</p>
      <LoginForm next={next} message={message ? messages[message] : undefined} />
      <p className="mt-6 text-center text-sm text-slate-600">
        New to Warehouse Ops?{" "}
        <Link href={next ? `/signup?next=${encodeURIComponent(next)}` : "/signup"} className="font-medium text-brand-600 hover:underline">
          Create an account
        </Link>
      </p>
    </>
  );
}
