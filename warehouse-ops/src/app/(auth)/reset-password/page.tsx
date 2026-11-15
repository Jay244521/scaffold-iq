import type { Metadata } from "next";
import { requireUser } from "@/lib/context";
import { ResetPasswordForm } from "../AuthForms";

export const metadata: Metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage() {
  await requireUser("/reset-password");
  return (
    <>
      <h1 className="mb-6 text-xl font-semibold text-slate-900">Choose a new password</h1>
      <ResetPasswordForm />
    </>
  );
}
