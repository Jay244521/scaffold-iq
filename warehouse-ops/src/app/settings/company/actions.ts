"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAppContext } from "@/lib/context";
import { friendlyError, logError } from "@/lib/errors";
import { can } from "@/lib/permissions";
import { isValidTimeZone } from "@/lib/timezone";
import type { ActionState } from "@/lib/validation";

const schema = z.object({
  name: z.string().trim().min(2, "Company name must be at least 2 characters").max(120),
  timezone: z.string().refine(isValidTimeZone, "Choose a valid time zone"),
});

export async function updateCompany(_: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await requireAppContext();
  if (!can.manageTeam(ctx.org.role)) return { error: "Only owners and admins can change company settings." };
  const parsed = schema.safeParse({ name: formData.get("name"), timezone: formData.get("timezone") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { data, error } = await ctx.supabase
    .from("organizations")
    .update({ name: parsed.data.name, timezone: parsed.data.timezone })
    .eq("id", ctx.org.orgId)
    .select("id");
  if (error) {
    logError("update company", error);
    return { error: friendlyError(error) };
  }
  if (!data?.length) return { error: "You don't have permission to change company settings." };
  revalidatePath("/", "layout");
  return { success: "Saved. Date filters, reports and exports now use this time zone." };
}
