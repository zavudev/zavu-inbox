"use client";

import { useActionState } from "react";
import { acceptInvite, type FormState } from "@/lib/actions/auth";
import { Button, Input, Label } from "@/components/ui/primitives";

export function JoinForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    acceptInvite,
    {}
  );

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />

      <div className="space-y-1.5">
        <Label htmlFor="name">Your name</Label>
        <Input id="name" name="name" required autoComplete="name" />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          minLength={10}
          autoComplete="new-password"
        />
        <p className="text-xs text-[var(--color-muted)]">At least 10 characters.</p>
      </div>

      {state.error ? (
        <p role="alert" className="text-sm text-[var(--color-error)]">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" variant="signal" className="w-full" disabled={pending}>
        {pending ? "Joining" : "Join workspace"}
      </Button>
    </form>
  );
}
