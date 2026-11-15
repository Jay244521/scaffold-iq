"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { FACILITY_COOKIE, ORG_COOKIE, cookieOptions, requireUser } from "@/lib/context";
import { friendlyError, logError } from "@/lib/errors";
import { fieldErrorsOf, formToObject, organizationSchema, type ActionState } from "@/lib/validation";

export async function createOrganization(_: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireUser("/onboarding");
  const parsed = organizationSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };

  // The database function creates the organization and makes the signed-in user
  // its owner in one transaction. The browser never supplies a user id or role.
  const { data: orgId, error } = await supabase.rpc("create_organization", {
    p_name: parsed.data.name,
    p_facility_name: parsed.data.facilityName ?? null,
  });
  if (error || !orgId) {
    logError("create_organization", error);
    return { error: friendlyError(error) };
  }
  const store = await cookies();
  store.set(ORG_COOKIE, orgId as string, cookieOptions);
  store.delete(FACILITY_COOKIE);
  redirect("/dashboard?welcome=1");
}
