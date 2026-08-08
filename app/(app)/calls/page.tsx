import Link from "next/link";
import { format } from "date-fns";
import { PhoneIncoming, PhoneOutgoing } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { zavu, ZavuApiError, describeZavuError } from "@/lib/zavu/client";
import { formatPhone } from "@/lib/utils";
import { Badge, Card, CopyableId, EmptyState } from "@/components/ui/primitives";
import type { ZavuVoiceCall } from "@/lib/zavu/types";

export default async function CallsPage() {
  await requireUser();

  let calls: ZavuVoiceCall[] = [];
  let error: { title: string; detail: string } | null = null;
  let featureOff = false;

  try {
    const page = await zavu().calls.list({ limit: 50 });
    calls = page.items;
  } catch (e) {
    if (e instanceof ZavuApiError && e.status === 403) {
      // Voice Agents is gated per team, so an operator without it gets an
      // explanation rather than a stack trace.
      featureOff = true;
    } else {
      error = describeZavuError(e);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-14 shrink-0 items-center border-b border-[var(--color-border)] px-6">
        <h1 className="text-sm font-medium">Calls</h1>
        <p className="ml-3 text-xs text-[var(--color-muted)]">
          Handled by your Zavu voice agent
        </p>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-6 scrollbar-thin">
        {featureOff ? (
          <EmptyState
            title="Voice agents are not enabled for this team"
            description="Ask Zavu to turn on Voice Agents, then configure a greeting and voice under Settings."
          />
        ) : error ? (
          <Card className="border-[var(--color-error)]/30 bg-[var(--color-error)]/5 p-4 text-sm">
            <p className="font-medium text-[var(--color-error)]">{error.title}</p>
            <p className="text-[var(--color-muted)]">{error.detail}</p>
          </Card>
        ) : calls.length === 0 ? (
          <EmptyState
            title="No calls yet"
            description="Calls answered or placed by your voice agent show up here with their transcript."
          />
        ) : (
          <Card className="divide-y divide-[var(--color-border)]">
            {calls.map((call) => (
              <Link
                key={call.id}
                href={`/calls/${call.id}`}
                className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--color-surface-2)]"
              >
                {call.direction === "inbound" ? (
                  <PhoneIncoming className="size-4 shrink-0 text-[var(--color-muted)]" />
                ) : (
                  <PhoneOutgoing className="size-4 shrink-0 text-[var(--color-muted)]" />
                )}

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {formatPhone(call.direction === "inbound" ? call.from : call.to)}
                  </p>
                  <p className="text-xs text-[var(--color-muted)]">
                    {format(new Date(call.createdAt), "d MMM, HH:mm")}
                    {call.durationSeconds
                      ? ` · ${formatDuration(call.durationSeconds)}`
                      : null}
                    {call.endReason ? ` · ${call.endReason.replace(/_/g, " ")}` : null}
                  </p>
                </div>

                <StatusBadge status={call.status} />
                {call.cost != null ? (
                  <span className="label-mono hidden sm:inline">
                    ${call.cost.toFixed(3)}
                  </span>
                ) : null}
                <CopyableId id={call.id} className="hidden md:inline" />
              </Link>
            ))}
          </Card>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "completed":
      return <Badge tone="success">Completed</Badge>;
    case "in_progress":
    case "ringing":
    case "queued":
      return <Badge tone="signal">{status.replace("_", " ")}</Badge>;
    case "failed":
      return <Badge tone="error">Failed</Badge>;
    default:
      return <Badge>{status.replace("_", " ")}</Badge>;
  }
}

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return minutes > 0 ? `${minutes}m ${rest}s` : `${rest}s`;
}
