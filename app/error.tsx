"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/primitives";

/**
 * Production hides the real message, so this page's job is to point at the two
 * things that are almost always wrong on a fresh install, and at the server log
 * that holds the actual answer.
 */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-dvh items-center justify-center px-6">
      <div className="w-full max-w-md space-y-6">
        <div className="space-y-2">
          <p className="label-mono">Zavu Inbox</p>
          <h1 className="text-2xl font-medium tracking-tight">Something broke</h1>
          <p className="text-sm text-[var(--color-muted)]">
            The full message is in the server log. On a fresh install it is nearly
            always one of these two.
          </p>
        </div>

        <ul className="space-y-3 text-sm">
          <li className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
            <p className="font-medium">The migrations have not run</p>
            <p className="mt-1 text-[var(--color-muted)]">
              Run <code className="font-mono text-xs">npm run db:migrate</code>, or
              check the <code className="font-mono text-xs">migrate</code> service if
              you are using Docker.
            </p>
          </li>
          <li className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
            <p className="font-medium">DATABASE_URL points somewhere unreachable</p>
            <p className="mt-1 text-[var(--color-muted)]">
              Check it in <code className="font-mono text-xs">.env</code>. Turso also
              needs <code className="font-mono text-xs">DATABASE_AUTH_TOKEN</code>.
            </p>
          </li>
        </ul>

        {error.digest ? (
          <p className="font-mono text-[11px] text-[var(--color-muted)]">
            digest {error.digest}
          </p>
        ) : null}

        <Button onClick={reset}>Try again</Button>
      </div>
    </main>
  );
}
