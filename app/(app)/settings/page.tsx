import Link from "next/link";
import { format } from "date-fns";
import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { workspace } from "@/lib/db/schema";
import { listInboxes, listMembers } from "@/lib/queries";
import { zavu, describeZavuError } from "@/lib/zavu/client";
import { formatPhone } from "@/lib/utils";
import { Avatar, Badge, Card, CopyableId } from "@/components/ui/primitives";
import { InviteForm } from "@/components/settings/invite-form";
import { ResyncButton } from "@/components/settings/resync-button";

export default async function SettingsPage() {
  const user = await requireUser();

  const [rows, members, inboxes] = await Promise.all([
    db.select().from(workspace).where(eq(workspace.id, "workspace")).limit(1),
    listMembers(),
    listInboxes(),
  ]);

  const config = rows[0];

  let connection: { project: string; team: string; testMode: boolean } | null = null;
  let connectionError: { title: string; detail: string } | null = null;
  try {
    const me = await zavu().me();
    connection = {
      project: me.project.name ?? me.project.id,
      team: me.team.name ?? me.team.id,
      testMode: me.isTestMode,
    };
  } catch (error) {
    connectionError = describeZavuError(error);
  }

  const webhookUrl = `${process.env.APP_URL ?? "http://localhost:4100"}/api/webhooks/zavu`;

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-14 shrink-0 items-center border-b border-[var(--color-border)] px-6">
        <h1 className="text-sm font-medium">Settings</h1>
        <nav className="ml-6 flex gap-4 text-sm text-[var(--color-muted)]">
          <Link href="/settings/snippets" className="hover:text-[var(--color-fg)]">
            Snippets
          </Link>
          <Link href="/settings/inboxes" className="hover:text-[var(--color-fg)]">
            Inboxes
          </Link>
          <Link href="/settings/agent" className="hover:text-[var(--color-fg)]">
            AI agents
          </Link>
        </nav>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-6 scrollbar-thin">
        <div className="mx-auto max-w-3xl space-y-6">
          <Card className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="label-mono pb-1">Zavu connection</p>
                {connection ? (
                  <>
                    <p className="text-sm">
                      {connection.project}
                      <span className="text-[var(--color-muted)]"> · {connection.team}</span>
                    </p>
                    {connection.testMode ? (
                      <Badge tone="warning" className="mt-1">
                        Test mode key: nothing is delivered
                      </Badge>
                    ) : null}
                  </>
                ) : (
                  <>
                    <p className="text-sm font-medium text-[var(--color-error)]">
                      {connectionError?.title}
                    </p>
                    <p className="text-xs text-[var(--color-muted)]">
                      {connectionError?.detail}
                    </p>
                  </>
                )}
                {config?.lastSyncAt ? (
                  <p className="mt-1 text-xs text-[var(--color-muted)]">
                    Last full sync {format(config.lastSyncAt, "d MMM yyyy, HH:mm")}
                  </p>
                ) : null}
              </div>
              {user.role !== "member" ? <ResyncButton /> : null}
            </div>
          </Card>

          <Card className="p-4">
            <p className="label-mono pb-2">Webhook endpoint</p>
            <p className="text-sm text-[var(--color-muted)]">
              Point each Zavu sender at this URL and subscribe to{" "}
              <code className="font-mono text-xs">message.inbound</code>,{" "}
              <code className="font-mono text-xs">message.sent</code>,{" "}
              <code className="font-mono text-xs">message.delivered</code>,{" "}
              <code className="font-mono text-xs">message.read</code>,{" "}
              <code className="font-mono text-xs">message.failed</code> and{" "}
              <code className="font-mono text-xs">conversation.new</code>.
            </p>
            <div className="mt-2">
              <CopyableId id={webhookUrl} />
            </div>
            {process.env.ZAVU_WEBHOOK_SECRET ? null : (
              <p className="mt-2 text-xs text-[var(--color-warning)]">
                ZAVU_WEBHOOK_SECRET is not set, so every delivery is rejected. Copy the
                sender webhook secret from Zavu into your .env.
              </p>
            )}
          </Card>

          <Card className="p-4">
            <p className="label-mono pb-3">Inboxes</p>
            {inboxes.length === 0 ? (
              <p className="text-sm text-[var(--color-muted)]">
                No senders found in Zavu. Connect a number or a channel there, then
                re-sync.
              </p>
            ) : (
              <ul className="divide-y divide-[var(--color-border)]">
                {inboxes.map((inbox) => (
                  <li key={inbox.id} className="flex items-center gap-3 py-2">
                    <span className="min-w-0 flex-1 truncate text-sm">{inbox.name}</span>
                    <span className="font-mono text-[11px] text-[var(--color-muted)]">
                      {inbox.phoneNumber ? formatPhone(inbox.phoneNumber) : "no number"}
                    </span>
                    <span className="hidden gap-1 sm:flex">
                      {inbox.channels.map((channel) => (
                        <Badge key={channel}>{channel}</Badge>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-4">
            <p className="label-mono pb-3">Members</p>
            <ul className="divide-y divide-[var(--color-border)]">
              {members.map((member) => (
                <li key={member.id} className="flex items-center gap-3 py-2">
                  <Avatar name={member.name} color={member.avatarColor} size={28} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{member.name}</p>
                    <p className="truncate text-xs text-[var(--color-muted)]">
                      {member.email}
                    </p>
                  </div>
                  <Badge tone={member.role === "owner" ? "signal" : "neutral"}>
                    {member.role}
                  </Badge>
                </li>
              ))}
            </ul>

            {user.role !== "member" ? (
              <div className="mt-4 border-t border-[var(--color-border)] pt-4">
                <InviteForm />
              </div>
            ) : null}
          </Card>
        </div>
      </div>
    </div>
  );
}
