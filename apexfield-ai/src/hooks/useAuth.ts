"use client";

import { useCallback, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { isManagerRole } from "@/lib/supabase/config";

export type Profile = {
  id: string;
  org_id: string;
  full_name: string;
  role: string;
  truck_label: string | null;
  experience_years: number | null;
  org_name: string | null;
};

export type AuthState =
  | { status: "loading" }
  | { status: "unconfigured" }
  | { status: "signed_out" }
  | { status: "signed_in"; user: User; profile: Profile | null; isManager: boolean };

/** Current user + technician profile, kept in sync with Supabase auth events. */
export function useAuth() {
  const sb = getBrowserSupabase();
  const [state, setState] = useState<AuthState>(sb ? { status: "loading" } : { status: "unconfigured" });

  const load = useCallback(async () => {
    if (!sb) return;
    const {
      data: { user },
    } = await sb.auth.getUser();
    if (!user) {
      setState({ status: "signed_out" });
      return;
    }
    const { data } = await sb
      .from("technicians")
      .select("id, org_id, full_name, role, truck_label, experience_years, organizations(name)")
      .eq("id", user.id)
      .maybeSingle();
    const row = data as (Omit<Profile, "org_name"> & { organizations: { name: string } | { name: string }[] | null }) | null;
    const org = Array.isArray(row?.organizations) ? row?.organizations[0] : row?.organizations;
    const profile: Profile | null = row?.org_id ? { ...row, org_name: org?.name ?? null } : null;
    setState({ status: "signed_in", user, profile, isManager: isManagerRole(profile?.role) });
  }, [sb]);

  useEffect(() => {
    if (!sb) return;
    void load();
    const { data } = sb.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") void load();
    });
    return () => data.subscription.unsubscribe();
  }, [sb, load]);

  const signOut = useCallback(async () => {
    await sb?.auth.signOut();
    setState({ status: "signed_out" });
  }, [sb]);

  return { ...state, state, reload: load, signOut, supabase: sb };
}
