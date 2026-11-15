"use client";

import { SubmitButton, useFormAction } from "@/components/client";
import { Alert } from "@/components/ui";
import type { ActionState } from "@/lib/validation";
import { acceptInvitation } from "./actions";

export function AcceptForm({ token }: { token: string }) {
  const [state, action, pending] = useFormAction(acceptInvitation, {} as ActionState);
  return (
    <form onSubmit={action} className="space-y-4">
      {state.error && <Alert>{state.error}</Alert>}
      <input type="hidden" name="token" value={token} />
      <SubmitButton pending={pending} className="w-full" pendingText="Joining…">
        Accept invitation
      </SubmitButton>
    </form>
  );
}
