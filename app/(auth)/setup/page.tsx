import { redirect } from "next/navigation";
import { isFirstRun } from "@/lib/auth/session";
import { SetupForm } from "./setup-form";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  if (!(await isFirstRun())) redirect("/login");

  const hasApiKey = Boolean(process.env.ZAVU_API_KEY);

  return (
    <main className="flex min-h-dvh items-center justify-center px-6 py-12">
      <div className="w-full max-w-md space-y-8">
        <div className="space-y-2">
          <p className="label-mono">Zavu Inbox · Setup</p>
          <h1 className="text-2xl font-medium tracking-tight">Create your workspace</h1>
          <p className="text-sm text-[var(--color-muted)]">
            This account owns the workspace. Your numbers, contacts and message
            history come from Zavu and get imported now.
          </p>
        </div>

        {hasApiKey ? null : (
          <div className="rounded-[var(--radius-card)] border border-[var(--color-warning)]/40 bg-[var(--color-warning)]/5 p-4 text-sm">
            <p className="font-medium text-[var(--color-warning)]">
              ZAVU_API_KEY is not set
            </p>
            <p className="mt-1 text-[var(--color-muted)]">
              You can still create the account, but nothing will import until you
              add the key to <code className="font-mono text-xs">.env</code> and
              re-sync from Settings.
            </p>
          </div>
        )}

        <SetupForm />
      </div>
    </main>
  );
}
