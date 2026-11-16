import type { Metadata } from "next";
import { Logo } from "@/components/Logo";
import { Alert, LinkButton } from "@/components/ui";
import { getUser } from "@/lib/context";
import { ROLE_LABELS, type Role } from "@/lib/permissions";
import { createServerSupabase } from "@/lib/supabase/server";
import { logOut } from "@/app/auth-forms/actions";
import { AcceptForm } from "./AcceptForm";

export const metadata: Metadata = { title: "Team invitation" };

type Preview = { organization_name: string; email: string; role: Role; status: string };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const valid = /^[a-f0-9]{64}$/.test(token);
  const supabase = await createServerSupabase();
  const { data } = valid ? await supabase.rpc("get_invitation_preview", { p_token: token }) : { data: null };
  const invite = (data as Preview[] | null)?.[0];
  const auth = await getUser();
  const next = `/invite/${token}`;

  let body: React.ReactNode;
  if (!invite) {
    body = <Alert>This invitation link is not valid. Ask your administrator for a new one.</Alert>;
  } else if (invite.status !== "pending") {
    body = <Alert>This invitation has {invite.status === "accepted" ? "already been used" : invite.status === "revoked" ? "been cancelled" : "expired"}. Ask your administrator for a new one.</Alert>;
  } else if (!auth) {
    body = (
      <div className="space-y-3">
        <p className="text-sm text-slate-600">
          Sign up or log in as <strong>{invite.email}</strong> to accept.
        </p>
        <LinkButton href={`/signup?next=${encodeURIComponent(next)}`} className="w-full">
          Create account
        </LinkButton>
        <LinkButton href={`/login?next=${encodeURIComponent(next)}`} variant="secondary" className="w-full">
          I already have an account
        </LinkButton>
      </div>
    );
  } else if ((auth.user.email ?? "").toLowerCase() !== invite.email) {
    body = (
      <div className="space-y-3">
        <Alert>
          This invitation was sent to <strong>{invite.email}</strong>, but you're logged in as <strong>{auth.user.email}</strong>.
        </Alert>
        <form action={logOut}>
          <button className="text-sm font-medium text-brand-600 hover:underline">Log out and switch accounts</button>
        </form>
      </div>
    );
  } else {
    body = <AcceptForm token={token} />;
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <Logo className="mb-8 text-lg text-slate-900" />
      <div className="card w-full max-w-md p-6 sm:p-8">
        <h1 className="text-xl font-semibold text-slate-900">
          {invite ? `Join ${invite.organization_name}` : "Team invitation"}
        </h1>
        {invite && invite.status === "pending" && (
          <p className="mb-6 mt-1 text-sm text-slate-600">
            You've been invited as <strong>{ROLE_LABELS[invite.role]}</strong>.
          </p>
        )}
        <div className={invite && invite.status === "pending" ? "" : "mt-4"}>{body}</div>
      </div>
    </div>
  );
}
