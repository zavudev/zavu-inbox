"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { format, isPast } from "date-fns";
import { Check, CheckSquare, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn, displayIdentifier } from "@/lib/utils";
import { Button, Card, EmptyState, Input } from "@/components/ui/primitives";
import { createTask, deleteTask, toggleTask } from "@/lib/actions/workspace";

export function TaskList({
  tasks,
}: {
  tasks: Array<{
    id: string;
    title: string;
    dueAt: Date | null;
    completedAt: Date | null;
    conversationId: string | null;
    contactIdentifier: string | null;
    contactName: string | null;
  }>;
}) {
  const [title, setTitle] = useState("");
  const [pending, startTransition] = useTransition();

  const add = () => {
    const trimmed = title.trim();
    if (!trimmed) return;

    startTransition(async () => {
      const result = await createTask({ title: trimmed });
      if (!result.ok) toast.error(result.error);
      else setTitle("");
    });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex gap-2">
        <Input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              add();
            }
          }}
          placeholder="What needs doing?"
        />
        <Button onClick={add} disabled={pending || !title.trim()}>
          Add
        </Button>
      </div>

      {tasks.length === 0 ? (
        <EmptyState
          icon={<CheckSquare className="size-6" />}
          title="Nothing on your list"
          description="Tasks you create from a conversation land here too."
        />
      ) : (
        <Card className="divide-y divide-[var(--color-border)]">
          {tasks.map((task) => {
            const overdue =
              task.dueAt && !task.completedAt && isPast(task.dueAt);

            return (
              <div key={task.id} className="flex items-start gap-3 px-4 py-3">
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
                      "text-sm",
                      task.completedAt && "text-[var(--color-muted)] line-through"
                    )}
                  >
                    {task.title}
                  </p>
                  <div className="flex items-center gap-2 text-[11px] text-[var(--color-muted)]">
                    {task.dueAt ? (
                      <span className={cn(overdue && "text-[var(--color-error)]")}>
                        Due {format(task.dueAt, "d MMM")}
                      </span>
                    ) : null}
                    {task.conversationId ? (
                      <Link
                        href={`/inbox/${task.conversationId}`}
                        className="truncate hover:text-[var(--color-fg)] hover:underline"
                      >
                        {displayIdentifier(
                          task.contactIdentifier ?? "",
                          task.contactName
                        )}
                      </Link>
                    ) : null}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    startTransition(async () => {
                      await deleteTask(task.id);
                    })
                  }
                  className="cursor-pointer text-[var(--color-muted)] transition-colors hover:text-[var(--color-error)]"
                  aria-label="Delete task"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}
