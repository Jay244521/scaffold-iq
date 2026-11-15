"use client";

import Link from "next/link";
import { SubmitButton, useFormAction } from "@/components/client";
import { Alert, Field, fieldAria } from "@/components/ui";
import type { ActionState } from "@/lib/validation";
import { logIn, requestPasswordReset, signUp, updatePassword } from "./actions";

export function LoginForm({ next, message }: { next?: string; message?: string }) {
  const [state, action, pending] = useFormAction(logIn, {} as ActionState);
  const fe = state.fieldErrors ?? {};
  return (
    <form onSubmit={action} className="space-y-4" noValidate>
      {message && <Alert tone="success">{message}</Alert>}
      {state.error && <Alert>{state.error}</Alert>}
      <input type="hidden" name="next" value={next ?? ""} />
      <Field label="Work email" name="email" error={fe.email}>
        <input {...fieldAria("email", fe.email)} type="email" autoComplete="email" required className="input" />
      </Field>
      <Field label="Password" name="password" error={fe.password}>
        <input {...fieldAria("password", fe.password)} type="password" autoComplete="current-password" required className="input" />
      </Field>
      <div className="flex justify-end text-sm">
        <Link href="/forgot-password" className="text-brand-600 hover:underline">
          Forgot password?
        </Link>
      </div>
      <SubmitButton pending={pending} className="w-full" pendingText="Logging in…">
        Log in
      </SubmitButton>
    </form>
  );
}

export function SignupForm({ next }: { next?: string }) {
  const [state, action, pending] = useFormAction(signUp, {} as ActionState);
  const fe = state.fieldErrors ?? {};
  if (state.success) return <Alert tone="success">{state.success}</Alert>;
  return (
    <form onSubmit={action} className="space-y-4" noValidate>
      {state.error && <Alert>{state.error}</Alert>}
      <input type="hidden" name="next" value={next ?? ""} />
      <Field label="Full name" name="fullName" error={fe.fullName}>
        <input {...fieldAria("fullName", fe.fullName)} autoComplete="name" required className="input" />
      </Field>
      <Field label="Work email" name="email" error={fe.email}>
        <input {...fieldAria("email", fe.email)} type="email" autoComplete="email" required className="input" />
      </Field>
      <Field label="Password" name="password" error={fe.password} hint="At least 8 characters.">
        <input {...fieldAria("password", fe.password)} type="password" autoComplete="new-password" required minLength={8} className="input" />
      </Field>
      <SubmitButton pending={pending} className="w-full" pendingText="Creating account…">
        Create account
      </SubmitButton>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, action, pending] = useFormAction(requestPasswordReset, {} as ActionState);
  const fe = state.fieldErrors ?? {};
  if (state.success) return <Alert tone="success">{state.success}</Alert>;
  return (
    <form onSubmit={action} className="space-y-4" noValidate>
      {state.error && <Alert>{state.error}</Alert>}
      <Field label="Work email" name="email" error={fe.email}>
        <input {...fieldAria("email", fe.email)} type="email" autoComplete="email" required className="input" />
      </Field>
      <SubmitButton pending={pending} className="w-full" pendingText="Sending…">
        Send reset link
      </SubmitButton>
    </form>
  );
}

export function ResetPasswordForm() {
  const [state, action, pending] = useFormAction(updatePassword, {} as ActionState);
  const fe = state.fieldErrors ?? {};
  return (
    <form onSubmit={action} className="space-y-4" noValidate>
      {state.error && <Alert>{state.error}</Alert>}
      <Field label="New password" name="password" error={fe.password} hint="At least 8 characters.">
        <input {...fieldAria("password", fe.password)} type="password" autoComplete="new-password" required className="input" />
      </Field>
      <Field label="Confirm new password" name="confirm" error={fe.confirm}>
        <input {...fieldAria("confirm", fe.confirm)} type="password" autoComplete="new-password" required className="input" />
      </Field>
      <SubmitButton pending={pending} className="w-full" pendingText="Saving…">
        Set new password
      </SubmitButton>
    </form>
  );
}
