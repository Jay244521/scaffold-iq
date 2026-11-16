"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAppContext } from "@/lib/context";
import { friendlyError, logError } from "@/lib/errors";
import { can } from "@/lib/permissions";
import type { ActionState } from "@/lib/validation";

const nameSchema = z.string().trim().min(1, "Enter a name").max(160, "Names must be 160 characters or fewer");

export async function renameSupplier(_: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await requireAppContext();
  if (!can.manageFacilities(ctx.org.role)) return { error: "Only managers and above can rename suppliers." };
  const id = z.uuid().safeParse(formData.get("supplierId"));
  const name = nameSchema.safeParse(formData.get("name"));
  if (!id.success) return { error: "Supplier not found." };
  if (!name.success) return { error: name.error.issues[0].message };
  const { data, error } = await ctx.supabase.from("suppliers").update({ name: name.data }).eq("id", id.data).eq("org_id", ctx.org.orgId).select("id");
  if (error) {
    if (error.code === "23505") return { error: `A supplier named "${name.data}" already exists. Use Merge instead.` };
    logError("rename supplier", error);
    return { error: friendlyError(error) };
  }
  if (!data?.length) return { error: "Supplier not found." };
  revalidatePath("/settings/suppliers");
  return { success: "Renamed." };
}

export async function mergeSupplier(_: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await requireAppContext();
  if (!can.manageFacilities(ctx.org.role)) return { error: "Only managers and above can merge suppliers." };
  const from = z.uuid().safeParse(formData.get("supplierId"));
  const into = z.uuid().safeParse(formData.get("intoId"));
  if (!from.success || !into.success) return { error: "Choose the supplier to merge into." };
  const { data, error } = await ctx.supabase.rpc("merge_suppliers", { p_from: from.data, p_into: into.data });
  if (error) {
    logError("merge_suppliers", error);
    return { error: friendlyError(error) };
  }
  revalidatePath("/dashboard");
  // The merged supplier's row disappears, so confirm at the top of the page.
  redirect(`/settings/suppliers?merged=${Number(data) || 0}`);
}
