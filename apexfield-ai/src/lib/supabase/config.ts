/**
 * Public Supabase settings (safe for the browser). The publishable / anon key only
 * grants what RLS allows; the service-role key never appears here.
 */
export const SUPABASE_PUBLIC_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const isAuthConfigured = () => Boolean(SUPABASE_PUBLIC_URL && SUPABASE_PUBLISHABLE_KEY);

/** Roles that can see the live fleet, send whispers and manage the team. */
export const MANAGER_ROLES = ["admin", "lead_tech"] as const;
export const TECH_ROLES = ["apprentice", "tech", "lead_tech", "admin"] as const;
export type TechRole = (typeof TECH_ROLES)[number];
export const isManagerRole = (r: string | null | undefined) => (MANAGER_ROLES as readonly string[]).includes(r ?? "");

/** Only allow same-site relative redirects after sign-in. */
export function safeNext(next: string | null | undefined, fallback: string): string {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : fallback;
}
