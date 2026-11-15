"use server";

import { redirect } from "next/navigation";
import { SITE_URL, isSupabaseConfigured } from "@/lib/env";
import { logError } from "@/lib/errors";
import { safeNext } from "@/lib/safe-next";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  fieldErrorsOf,
  formToObject,
  loginSchema,
  newPasswordSchema,
  resetRequestSchema,
  signupSchema,
  type ActionState,
} from "@/lib/validation";

const notConfigured: ActionState = { error: "Supabase is not configured yet. See the README to connect a project." };

/** Messages from Supabase Auth that are safe and useful to show. */
function authMessage(message: string) {
  if (/invalid login credentials/i.test(message)) return "Incorrect email or password.";
  if (/email not confirmed/i.test(message)) return "Please confirm your email address first. Check your inbox for the link.";
  if (/rate limit|too many/i.test(message)) return "Too many attempts. Please wait a few minutes and try again.";
  if (/password/i.test(message) && message.length < 160) return message;
  if (/already registered/i.test(message)) return "An account with this email already exists. Try logging in.";
  return "We couldn't complete that request. Please try again.";
}

export async function signUp(_: ActionState, formData: FormData): Promise<ActionState> {
  if (!isSupabaseConfigured()) return notConfigured;
  const raw = formToObject(formData);
  const parsed = signupSchema.safeParse(raw);
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };

  const next = safeNext(raw.next, "/onboarding");
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
      emailRedirectTo: `${SITE_URL}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });
  if (error) {
    logError("signUp", error);
    return { error: authMessage(error.message) };
  }
  if (data.session) redirect(next); // Email confirmation disabled in Supabase.
  return { success: `Check ${parsed.data.email} for a confirmation link to finish creating your account.` };
}

export async function logIn(_: ActionState, formData: FormData): Promise<ActionState> {
  if (!isSupabaseConfigured()) return notConfigured;
  const raw = formToObject(formData);
  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: authMessage(error.message) };
  redirect(safeNext(raw.next));
}

export async function logOut() {
  const supabase = await createServerSupabase();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function requestPasswordReset(_: ActionState, formData: FormData): Promise<ActionState> {
  if (!isSupabaseConfigured()) return notConfigured;
  const parsed = resetRequestSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };
  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${SITE_URL}/auth/callback?next=/reset-password`,
  });
  if (error) logError("resetPasswordForEmail", error);
  // Same answer either way, so this form can't be used to discover who has an account.
  return { success: "If an account exists for that email, we've sent a link to reset the password." };
}

export async function updatePassword(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = newPasswordSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Your reset link has expired. Request a new one." };
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: authMessage(error.message) };
  redirect("/dashboard");
}
