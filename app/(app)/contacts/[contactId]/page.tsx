import { notFound } from "next/navigation";
import { format } from "date-fns";
import { desc, eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { contactNotes, contactProperties, conversations, users } from "@/lib/db/schema";
import { zavu, ZavuApiError } from "@/lib/zavu/client";
import { displayIdentifier } from "@/lib/utils";
import { Avatar, Card, CopyableId } from "@/components/ui/primitives";
import { ChannelIcon } from "@/components/inbox/channel-icon";
import { ContactNotes } from "@/components/contacts/contact-notes";
import { ContactProperties } from "@/components/contacts/contact-properties";
import Link from "next/link";

export default async function ContactPage({
  params,
}: {
  params: Promise<{ contactId: string }>;
}) {
  await requireUser();
  const { contactId } = await params;

  let contact;
  try {
    contact = await zavu().contacts.get(contactId);
  } catch (error) {
    if (error instanceof ZavuApiError && error.status === 404) notFound();
    throw error;
  }

  const [notes, properties, threads] = await Promise.all([
    db
      .select({
        id: contactNotes.id,
        body: contactNotes.body,
        createdAt: contactNotes.createdAt,
        authorName: users.name,
        authorColor: users.avatarColor,
      })
      .from(contactNotes)
      .leftJoin(users, eq(contactNotes.createdBy, users.id))
      .where(eq(contactNotes.zavuContactId, contactId))
      .orderBy(desc(contactNotes.createdAt)),

    db
      .select()
      .from(contactProperties)
      .where(eq(contactProperties.zavuContactId, contactId)),

    db
      .select({
        zavuId: conversations.zavuId,
        lastMessageText: conversations.lastMessageText,
        lastMessageAt: conversations.lastMessageAt,
        lastMessageChannel: conversations.lastMessageChannel,
      })
      .from(conversations)
      .where(eq(conversations.zavuContactId, contactId))
      .orderBy(desc(conversations.lastMessageAt))
      .limit(10),
  ]);

  const name =
    contact.displayName ??
    contact.profileName ??
    displayIdentifier(contact.primaryPhone ?? contact.primaryEmail ?? contactId);

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-[var(--color-border)] px-6">
        <Avatar name={name} size={28} />
        <div className="min-w-0">
          <h1 className="truncate text-sm font-medium">{name}</h1>
          <CopyableId id={contact.id} />
        </div>
      </header>

      <div className="grid min-h-0 flex-1 gap-6 overflow-y-auto p-6 scrollbar-thin lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className="p-4">
            <p className="label-mono pb-3">Channels</p>
            {contact.channels && contact.channels.length > 0 ? (
              <ul className="space-y-2">
                {contact.channels.map((channel) => (
                  <li key={channel.id} className="flex items-center gap-2 text-sm">
                    <ChannelIcon channel={channel.channel} withLabel={false} />
                    <span className="font-mono text-xs">{channel.identifier}</span>
                    {channel.label ? (
                      <span className="label-mono">{channel.label}</span>
                    ) : null}
                    {channel.isPrimary ? (
                      <span className="label-mono">primary</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-[var(--color-muted)]">
                {contact.availableChannels.join(", ") || "No channels recorded."}
              </p>
            )}
          </Card>

          <Card className="p-4">
            <p className="label-mono pb-3">Conversations</p>
            {threads.length === 0 ? (
              <p className="text-sm text-[var(--color-muted)]">No threads yet.</p>
            ) : (
              <ul className="divide-y divide-[var(--color-border)]">
                {threads.map((thread) => (
                  <li key={thread.zavuId}>
                    <Link
                      href={`/inbox/${thread.zavuId}`}
                      className="flex items-center gap-3 py-2 transition-colors hover:bg-[var(--color-surface-2)]"
                    >
                      {thread.lastMessageChannel ? (
                        <ChannelIcon
                          channel={thread.lastMessageChannel}
                          withLabel={false}
                        />
                      ) : null}
                      <span className="min-w-0 flex-1 truncate text-sm">
                        {thread.lastMessageText || "Media message"}
                      </span>
                      <time className="shrink-0 text-xs text-[var(--color-muted)]">
                        {format(thread.lastMessageAt, "d MMM")}
                      </time>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <ContactNotes contactId={contactId} notes={notes} />
        </div>

        <div className="space-y-6">
          <ContactProperties contactId={contactId} properties={properties} />

          <Card className="p-4">
            <p className="label-mono pb-3">From Zavu</p>
            <dl className="space-y-2 text-xs">
              <Row label="Verified">{contact.verified ? "Yes" : "No"}</Row>
              {contact.countryCode ? (
                <Row label="Country">{contact.countryCode}</Row>
              ) : null}
              {contact.defaultChannel ? (
                <Row label="Preferred">{contact.defaultChannel}</Row>
              ) : null}
              <Row label="Created">
                {format(new Date(contact.createdAt), "d MMM yyyy")}
              </Row>
              {Object.entries(contact.metadata ?? {}).map(([key, value]) => (
                <Row key={key} label={key}>
                  {value}
                </Row>
              ))}
            </dl>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <dt className="w-24 shrink-0 text-[var(--color-muted)]">{label}</dt>
      <dd className="min-w-0 flex-1 break-words">{children}</dd>
    </div>
  );
}
