"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { format, isSameDay } from "date-fns";
import { AlertTriangle, Check, Clock, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { cn, displayIdentifier } from "@/lib/utils";
import {
  Avatar,
  Badge,
  Button,
  CopyableId,
  EmptyState,
} from "@/components/ui/primitives";
import {
  assignConversation,
  markConversationRead,
  setConversationStatus,
} from "@/lib/actions/conversations";
import { ChannelIcon } from "./channel-icon";
import { MessageBubble } from "./message-bubble";
import { Composer } from "./composer";
import { ThreadSidePanel } from "./thread-side-panel";
import type { Conversation, ScheduledMessage, Snippet } from "@/lib/db/schema";
import type { ZavuMessage } from "@/lib/zavu/types";

type Member = { id: string; name: string; avatarColor: string };

export function ThreadView({
  conversation,
  inboxName,
  assignee,
  availableChannels,
  messages,
  loadError,
  activity,
  members,
  tasks,
  scheduled,
  snippets,
  currentUser,
}: {
  conversation: Conversation;
  inboxName: string | null;
  assignee: { id: string; name: string; color: string } | null;
  availableChannels: string[];
  messages: ZavuMessage[];
  loadError: string | null;
  activity: {
    notes: Array<{
      id: string;
      body: string;
      createdAt: Date;
      userName: string | null;
      userColor: string | null;
    }>;
    events: Array<{
      id: string;
      type: string;
      value: string | null;
      createdAt: Date;
      actorName: string | null;
      targetName: string | null;
    }>;
  };
  members: Member[];
  tasks: Array<{
    id: string;
    title: string;
    dueAt: Date | null;
    completedAt: Date | null;
    assigneeName: string | null;
  }>;
  scheduled: ScheduledMessage[];
  snippets: Snippet[];
  currentUser: Member;
}) {
  const [pending, startTransition] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);
  const [assignOpen, setAssignOpen] = useState(false);

  const title = conversation.isGroup
    ? conversation.groupSubject ?? "Group chat"
    : displayIdentifier(conversation.contactIdentifier, conversation.contactName);

  // Opening a thread is reading it. Fire once per thread, and do not block the
  // render on it.
  useEffect(() => {
    if (conversation.unreadCount === 0) return;
    void markConversationRead(conversation.zavuId);
  }, [conversation.zavuId, conversation.unreadCount]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, conversation.zavuId]);

  // Messages and internal notes are one timeline: a note written between two
  // messages has to appear between them, or the thread reads as a lie.
  const timeline = useMemo(() => {
    const entries: Array<
      | { kind: "message"; at: number; message: ZavuMessage }
      | { kind: "note"; at: number; note: (typeof activity.notes)[number] }
      | { kind: "event"; at: number; event: (typeof activity.events)[number] }
    > = [];

    for (const message of messages) {
      entries.push({ kind: "message", at: new Date(message.createdAt).getTime(), message });
    }
    for (const note of activity.notes) {
      entries.push({ kind: "note", at: note.createdAt.getTime(), note });
    }
    for (const event of activity.events) {
      entries.push({ kind: "event", at: event.createdAt.getTime(), event });
    }

    return entries.sort((a, b) => a.at - b.at);
  }, [messages, activity.notes, activity.events]);

  const lastInbound = [...messages].reverse().find((m) => m.status === "received");

  const handleAssign = (userId: string | null) => {
    setAssignOpen(false);
    startTransition(async () => {
      const result = await assignConversation(conversation.zavuId, userId);
      if (!result.ok) toast.error(result.error);
    });
  };

  const handleStatus = (status: "open" | "done") => {
    startTransition(async () => {
      const result = await setConversationStatus(conversation.zavuId, status);
      if (!result.ok) toast.error(result.error);
      else if (status === "done") toast.success("Marked done");
    });
  };

  return (
    <div className="flex min-w-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-[var(--color-border)] px-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-sm font-medium">{title}</h1>
              {conversation.lastMessageChannel ? (
                <ChannelIcon channel={conversation.lastMessageChannel} withLabel={false} />
              ) : null}
              {conversation.status === "done" ? (
                <Badge tone="success">Done</Badge>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              {inboxName ? <span className="label-mono">{inboxName}</span> : null}
              <CopyableId id={conversation.zavuId} />
            </div>
          </div>

          <div className="relative flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setAssignOpen((open) => !open)}
              disabled={pending}
            >
              {assignee ? (
                <>
                  <Avatar name={assignee.name} color={assignee.color} size={18} />
                  <span className="max-w-24 truncate">{assignee.name}</span>
                </>
              ) : (
                <>
                  <UserPlus />
                  Assign
                </>
              )}
            </Button>

            {assignOpen ? (
              <div className="absolute right-0 top-9 z-20 w-56 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-1 shadow-lg">
                <button
                  type="button"
                  onClick={() => handleAssign(currentUser.id)}
                  className="flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-[var(--color-surface-2)]"
                >
                  <Avatar name={currentUser.name} color={currentUser.avatarColor} size={20} />
                  Assign to me
                </button>
                <div className="my-1 h-px bg-[var(--color-border)]" />
                {members
                  .filter((m) => m.id !== currentUser.id)
                  .map((member) => (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => handleAssign(member.id)}
                      className="flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-[var(--color-surface-2)]"
                    >
                      <Avatar name={member.name} color={member.avatarColor} size={20} />
                      <span className="truncate">{member.name}</span>
                    </button>
                  ))}
                {assignee ? (
                  <>
                    <div className="my-1 h-px bg-[var(--color-border)]" />
                    <button
                      type="button"
                      onClick={() => handleAssign(null)}
                      className="w-full cursor-pointer rounded px-2 py-1.5 text-left text-sm text-[var(--color-muted)] hover:bg-[var(--color-surface-2)]"
                    >
                      Unassign
                    </button>
                  </>
                ) : null}
              </div>
            ) : null}

            {conversation.status === "done" ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleStatus("open")}
                disabled={pending}
              >
                Reopen
              </Button>
            ) : (
              <Button size="sm" onClick={() => handleStatus("done")} disabled={pending}>
                <Check />
                Done
              </Button>
            )}
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 scrollbar-thin">
          {loadError ? (
            <div className="mb-4 flex items-start gap-2 rounded-[var(--radius-card)] border border-[var(--color-error)]/30 bg-[var(--color-error)]/5 p-3 text-sm">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[var(--color-error)]" />
              <div>
                <p className="font-medium text-[var(--color-error)]">
                  Could not load messages from Zavu
                </p>
                <p className="text-[var(--color-muted)]">{loadError}</p>
              </div>
            </div>
          ) : null}

          {timeline.length === 0 && !loadError ? (
            <EmptyState
              title="No messages yet"
              description="Send the first one below."
            />
          ) : null}

          {timeline.map((entry, index) => {
            const previous = timeline[index - 1];
            const showDate =
              !previous || !isSameDay(new Date(previous.at), new Date(entry.at));

            return (
              <div key={`${entry.kind}-${entryId(entry)}`}>
                {showDate ? (
                  <div className="my-4 flex items-center gap-3">
                    <div className="h-px flex-1 bg-[var(--color-border)]" />
                    <span className="label-mono">
                      {format(new Date(entry.at), "EEEE, d MMM")}
                    </span>
                    <div className="h-px flex-1 bg-[var(--color-border)]" />
                  </div>
                ) : null}

                {entry.kind === "message" ? (
                  <MessageBubble message={entry.message} />
                ) : entry.kind === "note" ? (
                  <InternalNote note={entry.note} />
                ) : (
                  <SystemEvent event={entry.event} />
                )}
              </div>
            );
          })}

          <div ref={bottomRef} />
        </div>

        <Composer
          conversationId={conversation.zavuId}
          channels={availableChannels}
          defaultChannel={conversation.lastMessageChannel ?? "sms"}
          snippets={snippets}
          members={members}
          lastInboundMessageId={lastInbound?.id}
          senderId={conversation.zavuSenderId}
          scheduled={scheduled}
        />
      </div>

      <ThreadSidePanel
        conversation={conversation}
        tasks={tasks}
        members={members}
        currentUserId={currentUser.id}
      />
    </div>
  );
}

function entryId(entry: {
  kind: string;
  message?: ZavuMessage;
  note?: { id: string };
  event?: { id: string };
}): string {
  return entry.message?.id ?? entry.note?.id ?? entry.event?.id ?? "unknown";
}

function InternalNote({
  note,
}: {
  note: {
    body: string;
    createdAt: Date;
    userName: string | null;
    userColor: string | null;
  };
}) {
  return (
    <div className="my-2 flex gap-2">
      <Avatar name={note.userName ?? "?"} color={note.userColor ?? "amber"} size={24} />
      <div className="max-w-[70%] rounded-[var(--radius-card)] border border-[var(--color-warning)]/30 bg-[var(--color-warning)]/5 px-3 py-2">
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-medium">{note.userName ?? "Someone"}</span>
          <span className="label-mono">Internal note</span>
          <time className="ml-auto text-[11px] text-[var(--color-muted)]">
            {format(note.createdAt, "HH:mm")}
          </time>
        </div>
        <p className="mt-1 whitespace-pre-wrap text-sm">{note.body}</p>
      </div>
    </div>
  );
}

function SystemEvent({
  event,
}: {
  event: {
    type: string;
    value: string | null;
    createdAt: Date;
    actorName: string | null;
    targetName: string | null;
  };
}) {
  const actor = event.actorName ?? "Someone";
  let text: string;

  switch (event.type) {
    case "assigned":
      // "Ana assigned this to Ana" is how a machine says "Ana took this".
      text =
        event.targetName && event.targetName === event.actorName
          ? `${actor} took this`
          : `${actor} assigned this to ${event.targetName ?? "someone"}`;
      break;
    case "unassigned":
      text = `${actor} unassigned this`;
      break;
    case "status_changed":
      text = `${actor} marked this ${event.value}`;
      break;
    case "snoozed":
      text = `${actor} snoozed this until ${
        event.value ? format(new Date(event.value), "d MMM, HH:mm") : "later"
      }`;
      break;
    default:
      text = `${actor} updated this conversation`;
  }

  return (
    <div className="my-2 flex items-center justify-center gap-2 text-[11px] text-[var(--color-muted)]">
      <Clock className="size-3" />
      <span>{text}</span>
      <span>·</span>
      <time>{format(event.createdAt, "HH:mm")}</time>
    </div>
  );
}
