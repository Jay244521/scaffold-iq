"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { FACILITY_COOKIE, ORG_COOKIE, cookieOptions, requireUser } from "@/lib/context";
import { friendlyError } from "@/lib/errors";
import type { ActionState } from "@/lib/validation";

export async function acceptInvitation(_: ActionState, formData: FormData): Promise<ActionState> {
  const token = String(formData.get("token") ?? "");
  if (!/^[a-f0-9]{64}$/.test(token)) return { error: "This invitation link is not valid." };
  const { supabase } = await requireUser(`/invite/${token}`);
  // The database checks the token, expiry and that it was sent to this user's confirmed email.
  const { data: orgId, error } = await supabase.rpc("accept_invitation", { p_token: token });
  if (error || !orgId) return { error: friendlyError(error) };
  const store = await cookies();
  store.set(ORG_COOKIE, orgId as string, cookieOptions);
  store.delete(FACILITY_COOKIE);
  redirect("/dashboard?joined=1");
}
