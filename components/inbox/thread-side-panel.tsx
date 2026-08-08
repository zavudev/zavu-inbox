"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { format } from "date-fns";
import { Check, Plus } from "lucide-react";
import { toast } from "sonner";
import { cn, displayIdentifier } from "@/lib/utils";
import { Button, CopyableId, Input } from "@/components/ui/primitives";
import { createTask, toggleTask } from "@/lib/actions/workspace";
import { snoozeConversation } from "@/lib/actions/conversations";
import { ChannelIcon } from "./channel-icon";
import type { Conversation } from "@/lib/db/schema";

export function ThreadSidePanel({
  conversation,
  tasks,
  members,
  currentUserId,
}: {
  conversation: Conversation;
  tasks: Array<{
    id: string;
    title: string;
    dueAt: Date | null;
    completedAt: Date | null;
    assigneeName: string | null;
  }>;
  members: Array<{ id: string; name: string }>;
  currentUserId: string;
}) {
  const [pending, startTransition] = useTransition();
  const [taskTitle, setTaskTitle] = useState("");

  const addTask = () => {
    const title = taskTitle.trim();
    if (!title) return;

    startTransition(async () => {
      const result = await createTask({
        title,
        conversationId: conversation.zavuId,
        assigneeId: currentUserId,
      });
      if (!result.ok) toast.error(result.error);
      else setTaskTitle("");
    });
  };

  const snooze = (hours: number) => {
    startTransition(async () => {
      const until = new Date(Date.now() + hours * 60 * 60 * 1000);
      const result = await snoozeConversation(conversation.zavuId, until);
      if (!result.ok) toast.error(result.error);
      else toast.success(`Snoozed until ${format(until, "d MMM, HH:mm")}`);
    });
  };

  return (
    <aside className="hidden w-72 shrink-0 flex-col overflow-y-auto border-l border-[var(--color-border)] bg-[var(--color-surface)] scrollbar-thin xl:flex">
      <section className="border-b border-[var(--color-border)] p-4">
        <p className="label-mono pb-2">Contact</p>

        <p className="text-sm font-medium">
          {displayIdentifier(conversation.contactIdentifier, conversation.contactName)}
        </p>

        <dl className="mt-3 space-y-2 text-xs">
          <Field label="Identifier">
            <CopyableId id={conversation.contactIdentifier} />
          </Field>
          {conversation.email ? (
            <Field label="Email">
              <span className="truncate">{conversation.email}</span>
            </Field>
          ) : null}
          {conversation.whatsappUsername ? (
            <Field label="WhatsApp">
              <span>@{conversation.whatsappUsername}</span>
            </Field>
          ) : null}
          <Field label="Channels">
            <span className="flex flex-wrap gap-1.5">
              {conversation.channels.map((channel) => (
                <ChannelIcon key={channel} channel={channel} />
              ))}
            </span>
          </Field>
          <Field label="Messages">
            <span>{conversation.messageCount}</span>
          </Field>
        </dl>

        {conversation.zavuContactId ? (
          <Button asChild variant="outline" size="sm" className="mt-3 w-full">
            <Link href={`/contacts/${conversation.zavuContactId}`}>
              Open contact record
            </Link>
          </Button>
        ) : (
          <p className="mt-3 text-xs text-[var(--color-muted)]">
            No contact record yet. Zavu creates one once the thread is linked.
          </p>
        )}
      </section>

      <section className="border-b border-[var(--color-border)] p-4">
        <p className="label-mono pb-2">Snooze</p>
        <div className="flex flex-wrap gap-1.5">
          <Button variant="outline" size="sm" onClick={() => snooze(3)} disabled={pending}>
            3 hours
          </Button>
          <Button variant="outline" size="sm" onClick={() => snooze(24)} disabled={pending}>
            Tomorrow
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => snooze(24 * 7)}
            disabled={pending}
          >
            Next week
          </Button>
        </div>
        {conversation.snoozedUntil ? (
          <p className="mt-2 text-xs text-[var(--color-muted)]">
            Returns {format(conversation.snoozedUntil, "d MMM, HH:mm")}
          </p>
        ) : null}
      </section>

      <section className="p-4">
        <p className="label-mono pb-2">Tasks</p>

        <ul className="space-y-1.5">
          {tasks.map((task) => (
            <li key={task.id} className="flex items-start gap-2">
              <button
                type="button"
                onClick={() =>
                  startTransition(async () => {
                    await toggleTask(task.id);
                  })
                }
                className={cn(
                  "mt-0.5 flex size-4 shrink-0 cursor-pointer items-center justify-center rounded border transition-colors",
                  task.completedAt
                    ? "border-[var(--color-success)] bg-[var(--color-success)] text-white"
                    : "border-[var(--color-border)] hover:border-[var(--color-fg)]"
                )}
                aria-label={task.completedAt ? "Reopen task" : "Complete task"}
              >
                {task.completedAt ? <Check className="size-3" /> : null}
              </button>
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "text-xs",
                    task.completedAt && "text-[var(--color-muted)] line-through"
                  )}
                >
                  {task.title}
                </p>
                {task.dueAt ? (
                  <p className="text-[11px] text-[var(--color-muted)]">
                    Due {format(task.dueAt, "d MMM")}
                  </p>
                ) : null}
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-2 flex gap-1.5">
          <Input
            value={taskTitle}
            onChange={(event) => setTaskTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addTask();
              }
            }}
            placeholder="Add a task"
            className="h-8 text-sm"
          />
          <Button
            size="icon"
            variant="outline"
            onClick={addTask}
            disabled={pending || !taskTitle.trim()}
            aria-label="Add task"
          >
            <Plus />
          </Button>
        </div>
      </section>
    </aside>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <dt className="w-20 shrink-0 text-[var(--color-muted)]">{label}</dt>
      <dd className="min-w-0 flex-1">{children}</dd>
    </div>
  );
}
