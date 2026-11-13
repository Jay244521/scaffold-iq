"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_PUBLIC_URL, SUPABASE_PUBLISHABLE_KEY, isAuthConfigured } from "./config";

let client: SupabaseClient | null | undefined;

/** Browser Supabase client with the signed-in user's session (cookie-backed). Null when not configured. */
export function getBrowserSupabase(): SupabaseClient | null {
  if (client === undefined) client = isAuthConfigured() ? createBrowserClient(SUPABASE_PUBLIC_URL, SUPABASE_PUBLISHABLE_KEY) : null;
  return client;
}
