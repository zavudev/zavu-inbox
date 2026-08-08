import { createHash } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { invites } from "@/lib/db/schema";
import { JoinForm } from "./join-form";

export const dynamic = "force-dynamic";

export default async function JoinPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const tokenHash = createHash("sha256").update(token).digest("hex");

  const rows = await db
    .select({ email: invites.email, role: invites.role })
    .from(invites)
    .where(
      and(
        eq(invites.tokenHash, tokenHash),
        isNull(invites.acceptedAt),
        gt(invites.expiresAt, new Date())
      )
    )
    .limit(1);

  const invite = rows[0];

  return (
    <main className="flex min-h-dvh items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-8">
        <div className="space-y-2">
          <p className="label-mono">Zavu Inbox</p>
          <h1 className="text-2xl font-medium tracking-tight">
            {invite ? "Join the workspace" : "Invitation not valid"}
          </h1>
          {invite ? (
            <p className="text-sm text-[var(--color-muted)]">
              Joining as {invite.email} with the {invite.role} role.
            </p>
          ) : (
            <p className="text-sm text-[var(--color-muted)]">
              This invitation has expired or has already been used. Ask an admin for
              a new link.
            </p>
          )}
        </div>

        {invite ? <JoinForm token={token} /> : null}
      </div>
    </main>
  );
}
