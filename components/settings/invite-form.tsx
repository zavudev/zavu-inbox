"use client";

import { useActionState } from "react";
import { createInvite, type FormState } from "@/lib/actions/auth";
import { Button, CopyableId, Input } from "@/components/ui/primitives";

export function InviteForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(
    createInvite,
    {}
  );

  return (
    <form action={action} className="space-y-2">
      <p className="label-mono">Invite a teammate</p>

      <div className="flex gap-2">
        <Input name="email" type="email" placeholder="teammate@company.com" required />
        <select
          name="role"
          className="h-9 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 text-sm"
        >
          <option value="member">Member</option>
          <option value="admin">Admin</option>
        </select>
        <Button type="submit" disabled={pending}>
          Invite
        </Button>
      </div>

      {state.error ? (
        <p role="alert" className="text-sm text-[var(--color-error)]">
          {state.error}
        </p>
      ) : null}

      {state.inviteUrl ? (
        <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3">
          <p className="text-xs text-[var(--color-muted)]">
            Send them this link. It expires in 7 days. Zavu Inbox does not assume you
            have a mail server.
          </p>
          <CopyableId id={state.inviteUrl} className="mt-1 block break-all" />
        </div>
      ) : null}
    </form>
  );
}
