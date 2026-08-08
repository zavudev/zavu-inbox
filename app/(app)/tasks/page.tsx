import { requireUser } from "@/lib/auth/session";
import { listTasks } from "@/lib/queries";
import { TaskList } from "@/components/tasks/task-list";

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ done?: string }>;
}) {
  const user = await requireUser();
  const { done } = await searchParams;
  const includeDone = done === "1";

  const tasks = await listTasks(user.id, { includeDone });

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-[var(--color-border)] px-6">
        <h1 className="text-sm font-medium">Tasks</h1>
        <a
          href={includeDone ? "/tasks" : "/tasks?done=1"}
          className="ml-auto cursor-pointer text-xs text-[var(--color-muted)] hover:text-[var(--color-fg)]"
        >
          {includeDone ? "Hide completed" : "Show completed"}
        </a>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-6 scrollbar-thin">
        <TaskList tasks={tasks} />
      </div>
    </div>
  );
}
