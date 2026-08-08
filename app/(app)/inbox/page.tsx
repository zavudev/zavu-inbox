import { requireUser } from "@/lib/auth/session";
import { listConversations, type InboxFilter } from "@/lib/queries";
import { ConversationList } from "@/components/inbox/conversation-list";
import { EmptyState } from "@/components/ui/primitives";
import { Inbox } from "lucide-react";

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; inbox?: string; channel?: string; q?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;

  const filter: InboxFilter = {
    view: (params.view as InboxFilter["view"]) ?? (params.inbox ? "all" : "open"),
    inboxId: params.inbox,
    channel: params.channel,
    search: params.q,
  };

  const items = await listConversations(user.id, filter);

  return (
    <div className="flex h-full">
      <ConversationList items={items} currentUserId={user.id} />
      <div className="hidden min-w-0 flex-1 items-center justify-center lg:flex">
        <EmptyState
          icon={<Inbox className="size-6" />}
          title="No conversation selected"
          description="Pick a thread on the left, or use the search to find a contact."
        />
      </div>
    </div>
  );
}
