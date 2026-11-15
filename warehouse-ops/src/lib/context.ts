import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { isSupabaseConfigured } from "@/lib/env";
import { createServerSupabase } from "@/lib/supabase/server";
import { isRole, type Role } from "@/lib/permissions";

export const ORG_COOKIE = "wo_org";
export const FACILITY_COOKIE = "wo_facility";

export type Facility = { id: string; name: string; code: string | null; address: string | null; is_active: boolean };
export type OrgMembership = { orgId: string; orgName: string; role: Role };
export type Member = { userId: string; role: Role; name: string; email: string };

export type AppContext = {
  supabase: SupabaseClient;
  user: User;
  profile: { full_name: string | null; email: string };
  memberships: OrgMembership[];
  org: OrgMembership;
  facilities: Facility[];
  /** The facility the user is working in, or null for "All facilities". */
  facility: Facility | null;
};

/** The signed-in user (verified with Supabase Auth, not just read from the cookie). */
export const getUser = cache(async (): Promise<{ supabase: SupabaseClient; user: User } | null> => {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { supabase, user } : null;
});

export async function requireUser(next?: string) {
  const auth = await getUser();
  if (!auth) redirect(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  return auth;
}

/**
 * Loads the user's organizations and picks the active one and facility from cookies.
 * Cookie values are only preferences: they're accepted only if they match an
 * organization the database says the user belongs to.
 */
export const getAppContext = cache(async (): Promise<AppContext | null> => {
  const auth = await getUser();
  if (!auth) return null;
  const { supabase, user } = auth;

  const [{ data: rows }, { data: profile }] = await Promise.all([
    supabase.from("memberships").select("org_id, role, organizations(name)").eq("user_id", user.id),
    supabase.from("profiles").select("full_name, email").eq("id", user.id).maybeSingle(),
  ]);

  const memberships: OrgMembership[] = (rows ?? [])
    .map((r: { org_id: string; role: string; organizations: { name: string } | { name: string }[] | null }) => {
      const org = Array.isArray(r.organizations) ? r.organizations[0] : r.organizations;
      return { orgId: r.org_id, orgName: org?.name ?? "Organization", role: r.role as Role };
    })
    .filter((m) => isRole(m.role))
    .sort((a, b) => a.orgName.localeCompare(b.orgName));

  const base = {
    supabase,
    user,
    profile: { full_name: profile?.full_name ?? null, email: profile?.email ?? user.email ?? "" },
    memberships,
  };
  if (memberships.length === 0) return { ...base, org: null as never, facilities: [], facility: null };

  const store = await cookies();
  const wantedOrg = store.get(ORG_COOKIE)?.value;
  const org = memberships.find((m) => m.orgId === wantedOrg) ?? memberships[0];

  const { data: facilityRows } = await supabase
    .from("facilities")
    .select("id, name, code, address, is_active")
    .eq("org_id", org.orgId)
    .order("name");
  const facilities = (facilityRows ?? []) as Facility[];
  const wantedFacility = store.get(FACILITY_COOKIE)?.value;
  const facility = facilities.find((f) => f.id === wantedFacility && f.is_active) ?? null;

  return { ...base, org, facilities, facility };
});

/** For pages inside the app: signed in and a member of at least one organization. */
export async function requireAppContext(): Promise<AppContext> {
  const ctx = await getAppContext();
  if (!ctx) redirect("/login");
  if (ctx.memberships.length === 0) redirect("/onboarding");
  return ctx;
}

/** Team members of the active organization with display names. */
export const getMembers = cache(async (orgId: string): Promise<Member[]> => {
  const auth = await getUser();
  if (!auth) return [];
  const { data: rows } = await auth.supabase.from("memberships").select("user_id, role").eq("org_id", orgId);
  const ids = (rows ?? []).map((r) => r.user_id as string);
  if (ids.length === 0) return [];
  const { data: profiles } = await auth.supabase.from("profiles").select("id, full_name, email").in("id", ids);
  const byId = new Map((profiles ?? []).map((p) => [p.id as string, p]));
  return (rows ?? [])
    .map((r) => {
      const p = byId.get(r.user_id as string);
      return {
        userId: r.user_id as string,
        role: r.role as Role,
        email: (p?.email as string) ?? "",
        name: ((p?.full_name as string) || (p?.email as string) || "Team member").trim(),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
});

export const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 180,
};
