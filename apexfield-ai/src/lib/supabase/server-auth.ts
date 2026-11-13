import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { SUPABASE_PUBLIC_URL, SUPABASE_PUBLISHABLE_KEY, isAuthConfigured } from "./config";

export type TechProfile = {
  id: string;
  org_id: string;
  full_name: string;
  role: string;
  truck_label: string | null;
  experience_years: number | null;
};

export type AuthContext = {
  /** Client acting as the signed-in user: every query goes through RLS. */
  supabase: SupabaseClient;
  user: User;
  /** Null when the account exists but isn't linked to a company. */
  tech: TechProfile | null;
};

export async function createServerSupabase(): Promise<SupabaseClient> {
  const store = await cookies();
  return createServerClient(SUPABASE_PUBLIC_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          /* called from a Server Component; middleware refreshes the session instead */
        }
      },
    },
  });
}

/** The signed-in user and their technician profile, or null when signed out / auth not configured. */
export async function getAuthContext(): Promise<AuthContext | null> {
  if (!isAuthConfigured()) return null;
  try {
    const supabase = await createServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    const { data } = await supabase
      .from("technicians")
      .select("id, org_id, full_name, role, truck_label, experience_years")
      .eq("id", user.id)
      .maybeSingle();
    const tech = data && (data as TechProfile).org_id ? (data as TechProfile) : null;
    return { supabase, user, tech };
  } catch (e) {
    console.error("[auth] getAuthContext failed:", e instanceof Error ? e.message : e);
    return null;
  }
}

/** Live AI may run without sign-in only when explicitly allowed (local development). */
export const allowAnonymousLive = () => process.env.LIVE_DEMO_ALLOW_ANONYMOUS === "true";
