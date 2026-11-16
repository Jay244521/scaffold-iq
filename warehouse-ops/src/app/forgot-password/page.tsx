import Link from "next/link";
import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/app/auth-forms/AuthForms";

export const metadata: Metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="text-xl font-semibold text-slate-900">Reset your password</h1>
      <p className="mb-6 mt-1 text-sm text-slate-600">We'll email you a link to choose a new password.</p>
      <ForgotPasswordForm />
      <p className="mt-6 text-center text-sm">
        <Link href="/login" className="font-medium text-brand-600 hover:underline">
          Back to log in
        </Link>
      </p>
    </>
  );
}
