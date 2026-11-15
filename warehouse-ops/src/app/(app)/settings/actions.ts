"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { FACILITY_COOKIE, ORG_COOKIE, getMembers, requireAppContext } from "@/lib/context";
import { SITE_URL } from "@/lib/env";
import { friendlyError, logError } from "@/lib/errors";
import { can, grantableRoles, invitableRoles, type Role } from "@/lib/permissions";
import { facilitySchema, fieldErrorsOf, formToObject, inviteSchema, roleChangeSchema, type ActionState } from "@/lib/validation";

// ---------------------------------------------------------------- facilities
export async function createFacility(_: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await requireAppContext();
  if (!can.manageFacilities(ctx.org.role)) return { error: "Only managers and above can add facilities." };
  const parsed = facilitySchema.safeParse(formToObject(formData));
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };
  const { error } = await ctx.supabase.from("facilities").insert({
    org_id: ctx.org.orgId,
    name: parsed.data.name,
    code: parsed.data.code ?? null,
    address: parsed.data.address ?? null,
  });
  if (error) return { error: error.code === "23505" ? "A facility with that name already exists." : friendlyError(error) };
  revalidatePath("/", "layout");
  return { success: `${parsed.data.name} added.` };
}

export async function updateFacility(_: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await requireAppContext();
  if (!can.manageFacilities(ctx.org.role)) return { error: "Only managers and above can edit facilities." };
  const id = z.uuid().safeParse(formData.get("facilityId"));
  const parsed = facilitySchema.safeParse(formToObject(formData));
  if (!id.success) return { error: "Facility not found." };
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };
  const { data, error } = await ctx.supabase
    .from("facilities")
    .update({ name: parsed.data.name, code: parsed.data.code ?? null, address: parsed.data.address ?? null })
    .eq("id", id.data)
    .eq("org_id", ctx.org.orgId)
    .select("id");
  if (error) return { error: error.code === "23505" ? "A facility with that name already exists." : friendlyError(error) };
  if (!data?.length) return { error: "Facility not found." };
  revalidatePath("/", "layout");
  return { success: "Saved." };
}

export async function setFacilityActive(formData: FormData) {
  const ctx = await requireAppContext();
  if (!can.manageFacilities(ctx.org.role)) return;
  const id = z.uuid().safeParse(formData.get("facilityId"));
  if (!id.success) return;
  const active = formData.get("active") === "true";
  const { error } = await ctx.supabase.from("facilities").update({ is_active: active }).eq("id", id.data).eq("org_id", ctx.org.orgId);
  if (error) logError("toggle facility", error);
  revalidatePath("/", "layout");
}

// ---------------------------------------------------------------- team
export type InviteState = ActionState & { link?: string; email?: string };

export async function inviteMember(_: InviteState, formData: FormData): Promise<InviteState> {
  const ctx = await requireAppContext();
  if (!can.manageTeam(ctx.org.role)) return { error: "Only owners and admins can invite team members." };
  const parsed = inviteSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };
  if (!invitableRoles(ctx.org.role).includes(parsed.data.role as Role)) return { error: "You can't invite someone with that role." };

  const { data: token, error } = await ctx.supabase.rpc("create_invitation", {
    p_org: ctx.org.orgId,
    p_email: parsed.data.email,
    p_role: parsed.data.role,
  });
  if (error || !token) return { error: friendlyError(error) };
  revalidatePath("/settings/team");
  // Shown once. Only a hash of the token is stored, so it can't be recovered later.
  return { link: `${SITE_URL}/invite/${token as string}`, email: parsed.data.email, success: "Invitation created." };
}

export async function revokeInvitation(formData: FormData) {
  const ctx = await requireAppContext();
  if (!can.manageTeam(ctx.org.role)) return;
  const id = z.uuid().safeParse(formData.get("invitationId"));
  if (!id.success) return;
  const { error } = await ctx.supabase.rpc("revoke_invitation", { p_invitation: id.data });
  if (error) logError("revoke invitation", error);
  revalidatePath("/settings/team");
}

export async function changeRole(_: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await requireAppContext();
  if (!can.manageTeam(ctx.org.role)) return { error: "Only owners and admins can change roles." };
  const parsed = roleChangeSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { error: "Choose a valid role." };
  if (parsed.data.userId === ctx.user.id) return { error: "You can't change your own role." };
  if (!grantableRoles(ctx.org.role).includes(parsed.data.role)) return { error: "You can't grant that role." };
  const target = (await getMembers(ctx.org.orgId)).find((m) => m.userId === parsed.data.userId);
  if (!target) return { error: "Team member not found." };
  if (target.role === "owner" && ctx.org.role !== "owner") return { error: "Only an owner can change another owner's role." };

  const { error } = await ctx.supabase
    .from("memberships")
    .update({ role: parsed.data.role })
    .eq("org_id", ctx.org.orgId)
    .eq("user_id", parsed.data.userId);
  if (error) return { error: friendlyError(error) };
  revalidatePath("/settings/team");
  return { success: `${target.name} is now ${parsed.data.role}.` };
}

export async function removeMember(_: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await requireAppContext();
  const userId = z.uuid().safeParse(formData.get("userId"));
  if (!userId.success) return { error: "Team member not found." };
  const leaving = userId.data === ctx.user.id;
  if (!leaving && !can.manageTeam(ctx.org.role)) return { error: "Only owners and admins can remove team members." };

  const { data, error } = await ctx.supabase
    .from("memberships")
    .delete()
    .eq("org_id", ctx.org.orgId)
    .eq("user_id", userId.data)
    .select("user_id");
  if (error) return { error: friendlyError(error) };
  if (!data?.length) return { error: "You don't have permission to remove this member." };
  if (leaving) {
    const store = await cookies();
    store.delete(ORG_COOKIE);
    store.delete(FACILITY_COOKIE);
    redirect("/dashboard");
  }
  revalidatePath("/settings/team");
  return { success: "Member removed." };
}
