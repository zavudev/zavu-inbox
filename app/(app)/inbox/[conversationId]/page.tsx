import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import {
  getConversation,
  getConversationActivity,
  listConversationTasks,
  listConversations,
  listInboxes,
  listMembers,
  listPendingScheduled,
  type InboxFilter,
} from "@/lib/queries";
import { listSnippetsFor } from "@/lib/actions/workspace";
import { zavu, describeZavuError } from "@/lib/zavu/client";
import { ConversationList } from "@/components/inbox/conversation-list";
import { ThreadView } from "@/components/inbox/thread-view";
import type { ZavuMessage } from "@/lib/zavu/types";

export default async function ConversationPage({
  params,
  searchParams,
}: {
  params: Promise<{ conversationId: string }>;
  searchParams: Promise<{ view?: string; inbox?: string; channel?: string; q?: string }>;
}) {
  const user = await requireUser();
  const { conversationId } = await params;
  const query = await searchParams;

  const record = await getConversation(conversationId);
  if (!record) notFound();

  const filter: InboxFilter = {
    view: (query.view as InboxFilter["view"]) ?? (query.inbox ? "all" : "open"),
    inboxId: query.inbox,
    channel: query.channel,
    search: query.q,
  };

  // Message bodies are not mirrored locally: they are fetched per thread so the
  // app never drifts from what Zavu actually holds.
  let messages: ZavuMessage[] = [];
  let loadError: string | null = null;
  try {
    const page = await zavu().conversations.messages(conversationId, { limit: 60 });
    messages = [...page.items].reverse();
  } catch (error) {
    const described = describeZavuError(error);
    loadError = `${described.title}. ${described.detail}`;
  }

  const [items, activity, members, inboxes, tasks, scheduled, snippets] =
    await Promise.all([
      listConversations(user.id, filter),
      getConversationActivity(conversationId),
      listMembers(),
      listInboxes(),
      listConversationTasks(conversationId),
      listPendingScheduled(conversationId),
      listSnippetsFor(user.id),
    ]);

  const inbox = inboxes.find((i) => i.id === record.conversation.inboxId);

  return (
    <div className="flex h-full">
      <div className="hidden lg:flex">
        <ConversationList items={items} currentUserId={user.id} />
      </div>
      <ThreadView
        conversation={record.conversation}
        inboxName={record.inboxName}
        assignee={
          record.conversation.assigneeId
            ? {
                id: record.conversation.assigneeId,
                name: record.assigneeName ?? "Unknown",
                color: record.assigneeColor ?? "violet",
              }
            : null
        }
        availableChannels={inbox?.channels ?? []}
        messages={messages}
        loadError={loadError}
        activity={activity}
        members={members}
        tasks={tasks}
        scheduled={scheduled}
        snippets={snippets}
        currentUser={{ id: user.id, name: user.name, avatarColor: user.avatarColor }}
      />
    </div>
  );
}
