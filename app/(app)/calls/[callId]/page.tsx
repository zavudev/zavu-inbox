import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { zavu, ZavuApiError } from "@/lib/zavu/client";
import { cn, formatPhone } from "@/lib/utils";
import { Card, CopyableId, EmptyState } from "@/components/ui/primitives";

export default async function CallPage({
  params,
}: {
  params: Promise<{ callId: string }>;
}) {
  await requireUser();
  const { callId } = await params;

  let call;
  try {
    call = await zavu().calls.get(callId);
  } catch (error) {
    if (error instanceof ZavuApiError && error.status === 404) notFound();
    throw error;
  }

  const transcript = call.transcript ?? [];

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-[var(--color-border)] px-6">
        <Link
          href="/calls"
          className="text-[var(--color-muted)] transition-colors hover:text-[var(--color-fg)]"
          aria-label="Back to calls"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <div className="min-w-0">
          <h1 className="truncate text-sm font-medium">
            {formatPhone(call.direction === "inbound" ? call.from : call.to)}
          </h1>
          <CopyableId id={call.id} />
        </div>
      </header>

      <div className="grid min-h-0 flex-1 gap-6 overflow-y-auto p-6 scrollbar-thin lg:grid-cols-3">
        <Card className="p-4 lg:col-span-2">
          <p className="label-mono pb-3">Transcript</p>

          {transcript.length === 0 ? (
            <EmptyState
              title="No transcript"
              description="The call produced no turns, or it is still in progress."
            />
          ) : (
            <ul className="space-y-3">
              {transcript.map((turn) => (
                <li
                  key={turn.seq}
                  className={cn(
                    "flex",
                    turn.role === "assistant" ? "justify-end" : "justify-start"
                  )}
                >
                  <div className="max-w-[75%]">
                    <p className="label-mono pb-1">
                      {turn.role === "assistant"
                        ? "Agent"
                        : turn.role === "tool"
                          ? "Tool call"
                          : "Caller"}
                    </p>
                    <div
                      className={cn(
                        "rounded-[var(--radius-card)] px-3 py-2 text-sm",
                        turn.role === "assistant"
                          ? "bg-[var(--color-signal)] text-white"
                          : turn.role === "tool"
                            ? "border border-[var(--color-border)] font-mono text-xs"
                            : "bg-[var(--color-surface-2)]"
                      )}
                    >
                      {turn.text}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="h-fit p-4">
          <p className="label-mono pb-3">Call</p>
          <dl className="space-y-2 text-xs">
            <Row label="Direction">{call.direction}</Row>
            <Row label="Status">{call.status.replace(/_/g, " ")}</Row>
            <Row label="From">{formatPhone(call.from)}</Row>
            <Row label="To">{formatPhone(call.to)}</Row>
            {call.durationSeconds != null ? (
              <Row label="Duration">{call.durationSeconds}s</Row>
            ) : null}
            {call.turnCount != null ? <Row label="Turns">{call.turnCount}</Row> : null}
            {call.endReason ? (
              <Row label="Ended">{call.endReason.replace(/_/g, " ")}</Row>
            ) : null}
            {call.cost != null ? <Row label="Cost">${call.cost.toFixed(4)}</Row> : null}
            <Row label="Started">
              {format(new Date(call.createdAt), "d MMM yyyy, HH:mm")}
            </Row>
          </dl>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <dt className="w-20 shrink-0 text-[var(--color-muted)]">{label}</dt>
      <dd className="min-w-0 flex-1 break-words">{children}</dd>
    </div>
  );
}
