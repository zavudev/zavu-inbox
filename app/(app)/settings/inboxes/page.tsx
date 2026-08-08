import { requireUser } from "@/lib/auth/session";
import { listInboxes } from "@/lib/queries";
import { EmptyState } from "@/components/ui/primitives";
import { InboxSettings } from "@/components/settings/inbox-settings";

export default async function InboxSettingsPage() {
  const user = await requireUser();
  const inboxes = await listInboxes();

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-14 shrink-0 items-center border-b border-[var(--color-border)] px-6">
        <h1 className="text-sm font-medium">Inboxes</h1>
        <p className="ml-3 text-xs text-[var(--color-muted)]">
          One per Zavu sender. Business hours drive the away message.
        </p>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-6 scrollbar-thin">
        <div className="mx-auto max-w-2xl space-y-4">
          {inboxes.length === 0 ? (
            <EmptyState
              title="No inboxes"
              description="Connect a sender in Zavu, then re-sync from Settings."
            />
          ) : (
            inboxes.map((inbox) => (
              <InboxSettings
                key={inbox.id}
                inbox={{
                  id: inbox.id,
                  name: inbox.name,
                  phoneNumber: inbox.phoneNumber,
                  timezone: inbox.timezone,
                  businessHours: inbox.businessHours,
                  awayMessage: inbox.awayMessage,
                  awayMessageEnabled: inbox.awayMessageEnabled,
                  channels: inbox.channels,
                }}
                editable={user.role !== "member"}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
