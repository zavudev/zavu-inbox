import { requireUser } from "@/lib/auth/session";
import { countUnreadMentions, getInboxCounts, listInboxes } from "@/lib/queries";
import { AppSidebar } from "@/components/app-sidebar";
import { LiveEvents } from "@/components/live-events";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await requireUser();
  const [inboxes, counts, mentionCount] = await Promise.all([
    listInboxes(),
    getInboxCounts(user.id),
    countUnreadMentions(user.id),
  ]);

  return (
    <div className="flex h-dvh overflow-hidden">
      <AppSidebar
        user={{ id: user.id, name: user.name, role: user.role, avatarColor: user.avatarColor }}
        inboxes={inboxes.map((i) => ({
          id: i.id,
          name: i.name,
          phoneNumber: i.phoneNumber,
          channels: i.channels,
        }))}
        counts={counts}
        mentionCount={mentionCount}
      />
      <div className="min-w-0 flex-1">{children}</div>
      {/* One SSE connection for the whole app; it refreshes the route on change. */}
      <LiveEvents />
    </div>
  );
}
