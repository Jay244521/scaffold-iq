import type { Metadata } from "next";
import { LocalTime } from "@/components/client";
import { Card, PageHeader } from "@/components/ui";
import { getMembers, requireAppContext } from "@/lib/context";
import { ROLE_DESCRIPTIONS, ROLE_LABELS, ROLES, can, grantableRoles, invitableRoles, type Role } from "@/lib/permissions";
import { revokeInvitation } from "../actions";
import { InviteForm, RemoveMemberButton, RoleSelect } from "../SettingsForms";

export const metadata: Metadata = { title: "Team" };

type Invitation = { id: string; email: string; role: Role; created_at: string; expires_at: string };

export default async function TeamPage() {
  const ctx = await requireAppContext();
  const manage = can.manageTeam(ctx.org.role);
  const members = await getMembers(ctx.org.orgId);
  const { data: invites } = manage
    ? await ctx.supabase
        .from("invitations")
        .select("id, email, role, created_at, expires_at")
        .eq("org_id", ctx.org.orgId)
        .is("accepted_at", null)
        .is("revoked_at", null)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
    : { data: [] };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader title="Team" description={`People with access to ${ctx.org.orgName}.`} />

      {manage && (
        <Card title="Invite a team member">
          <InviteForm roles={invitableRoles(ctx.org.role)} />
          {(invites ?? []).length > 0 && (
            <div className="mt-6">
              <h3 className="mb-2 text-sm font-semibold text-slate-900">Pending invitations</h3>
              <ul className="divide-y divide-slate-100 rounded-md border border-slate-200">
                {(invites as Invitation[]).map((i) => (
                  <li key={i.id} className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm">
                    <span className="min-w-0 flex-1 truncate">{i.email}</span>
                    <span className="text-slate-600">{ROLE_LABELS[i.role]}</span>
                    <span className="text-xs text-slate-500">
                      expires <LocalTime value={i.expires_at} mode="date" />
                    </span>
                    <form action={revokeInvitation}>
                      <input type="hidden" name="invitationId" value={i.id} />
                      <button className="text-red-700 hover:underline">Revoke</button>
                    </form>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      )}

      <Card title={`${members.length} member${members.length === 1 ? "" : "s"}`}>
        <ul className="-my-2 divide-y divide-slate-100">
          {members.map((m) => {
            const self = m.userId === ctx.user.id;
            const editable = manage && !self && (m.role !== "owner" || ctx.org.role === "owner");
            return (
              <li key={m.userId} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-900">
                    {m.name} {self && <span className="text-xs font-normal text-slate-500">(you)</span>}
                  </p>
                  <p className="truncate text-sm text-slate-500">{m.email}</p>
                </div>
                {editable ? (
                  <RoleSelect userId={m.userId} role={m.role} roles={grantableRoles(ctx.org.role)} />
                ) : (
                  <span className="rounded bg-slate-100 px-2 py-1 text-sm text-slate-700">{ROLE_LABELS[m.role]}</span>
                )}
                {(editable || self) && <RemoveMemberButton userId={m.userId} label={m.name} self={self} />}
              </li>
            );
          })}
        </ul>
      </Card>

      <Card title="What each role can do">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          {[...ROLES].reverse().map((r) => (
            <div key={r}>
              <dt className="font-medium text-slate-900">{ROLE_LABELS[r]}</dt>
              <dd className="text-slate-600">{ROLE_DESCRIPTIONS[r]}</dd>
            </div>
          ))}
        </dl>
      </Card>
    </div>
  );
}
