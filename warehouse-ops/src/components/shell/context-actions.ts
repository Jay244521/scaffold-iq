"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { FACILITY_COOKIE, ORG_COOKIE, cookieOptions, requireAppContext } from "@/lib/context";

/** Switch the active organization — accepted only if the user is a member. */
export async function switchOrganization(formData: FormData) {
  const ctx = await requireAppContext();
  const orgId = z.uuid().safeParse(formData.get("orgId"));
  if (!orgId.success || !ctx.memberships.some((m) => m.orgId === orgId.data)) return;
  const store = await cookies();
  store.set(ORG_COOKIE, orgId.data, cookieOptions);
  store.delete(FACILITY_COOKIE);
  revalidatePath("/", "layout");
}

/** Switch the working facility — accepted only if it belongs to the active organization. */
export async function switchFacility(formData: FormData) {
  const ctx = await requireAppContext();
  const value = String(formData.get("facilityId") ?? "");
  const store = await cookies();
  if (value === "all") {
    store.delete(FACILITY_COOKIE);
  } else if (ctx.facilities.some((f) => f.id === value && f.is_active)) {
    store.set(FACILITY_COOKIE, value, cookieOptions);
  }
  revalidatePath("/", "layout");
}
