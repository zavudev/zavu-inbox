import { requireUser } from "@/lib/auth/session";
import { zavu, describeZavuError } from "@/lib/zavu/client";
import { Badge, Card, CopyableId, EmptyState } from "@/components/ui/primitives";
import { AgentTester } from "@/components/settings/agent-tester";
import type { ZavuAgent } from "@/lib/zavu/types";

/**
 * Read-only view of the Zavu AI agents that answer for this project, plus a dry
 * run. Editing prompts happens in Zavu: duplicating that editor here would give
 * two places to change the same thing.
 */
export default async function AgentSettingsPage() {
  await requireUser();

  let agents: ZavuAgent[] = [];
  let error: { title: string; detail: string } | null = null;

  try {
    const page = await zavu().agents.list({ limit: 50 });
    agents = page.items;
  } catch (e) {
    error = describeZavuError(e);
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-14 shrink-0 items-center border-b border-[var(--color-border)] px-6">
        <h1 className="text-sm font-medium">AI agents</h1>
        <p className="ml-3 text-xs text-[var(--color-muted)]">
          Answer when nobody on the team can
        </p>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-6 scrollbar-thin">
        <div className="mx-auto max-w-2xl space-y-4">
          {error ? (
            <Card className="border-[var(--color-error)]/30 bg-[var(--color-error)]/5 p-4 text-sm">
              <p className="font-medium text-[var(--color-error)]">{error.title}</p>
              <p className="text-[var(--color-muted)]">{error.detail}</p>
            </Card>
          ) : agents.length === 0 ? (
            <EmptyState
              title="No agents configured"
              description="Create one in the Zavu dashboard, connect it to a sender, and it shows up here."
            />
          ) : (
            agents.map((agent) => (
              <Card key={agent.id} className="p-4">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium">{agent.name}</p>
                      {agent.enabled ? (
                        <Badge tone="success">Enabled</Badge>
                      ) : (
                        <Badge>Disabled</Badge>
                      )}
                      {agent.voice?.enabled ? <Badge tone="signal">Voice</Badge> : null}
                    </div>
                    <p className="label-mono pt-0.5">
                      {agent.provider} · {agent.model}
                    </p>
                    <CopyableId id={agent.id} />
                  </div>
                </div>

                <p className="mt-3 line-clamp-4 whitespace-pre-wrap text-xs text-[var(--color-muted)]">
                  {agent.systemPrompt}
                </p>

                <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-[var(--color-muted)]">
                  <span>
                    Channels: {agent.triggerOnChannels?.join(", ") ?? "all"}
                  </span>
                  {agent.senderIds?.length ? (
                    <span>· {agent.senderIds.length} sender(s)</span>
                  ) : null}
                  {agent.stats ? (
                    <span>· {agent.stats.totalInvocations} replies</span>
                  ) : null}
                </div>

                <div className="mt-4 border-t border-[var(--color-border)] pt-3">
                  <AgentTester agentId={agent.id} />
                </div>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
