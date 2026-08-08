import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { zavu, describeZavuError } from "@/lib/zavu/client";
import { displayIdentifier } from "@/lib/utils";
import { Avatar, Card, CopyableId, EmptyState } from "@/components/ui/primitives";
import { ChannelIcon } from "@/components/inbox/channel-icon";
import { Users } from "lucide-react";
import type { ZavuContact } from "@/lib/zavu/types";

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string; q?: string }>;
}) {
  await requireUser();
  const { cursor, q } = await searchParams;

  let items: ZavuContact[] = [];
  let nextCursor: string | null = null;
  let error: { title: string; detail: string } | null = null;

  try {
    const page = await zavu().contacts.list({
      limit: 50,
      cursor,
      // The API filters by exact phone; anything else is matched client side
      // below rather than pretending we have full-text search.
      phoneNumber: q?.startsWith("+") ? q : undefined,
    });
    items = page.items;
    nextCursor = page.nextCursor;
  } catch (e) {
    error = describeZavuError(e);
  }

  const filtered = q && !q.startsWith("+")
    ? items.filter((c) =>
        [c.displayName, c.primaryPhone, c.primaryEmail, c.profileName]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(q.toLowerCase()))
      )
    : items;

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-[var(--color-border)] px-6">
        <h1 className="text-sm font-medium">Contacts</h1>
        <form className="ml-auto">
          <input
            name="q"
            defaultValue={q}
            placeholder="Search this page, or type +phone"
            className="h-8 w-72 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm outline-none placeholder:text-[var(--color-muted)] focus-visible:border-[var(--color-signal)]"
          />
        </form>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-6 scrollbar-thin">
        {error ? (
          <Card className="border-[var(--color-error)]/30 bg-[var(--color-error)]/5 p-4 text-sm">
            <p className="font-medium text-[var(--color-error)]">{error.title}</p>
            <p className="text-[var(--color-muted)]">{error.detail}</p>
          </Card>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Users className="size-6" />}
            title="No contacts"
            description="Contacts appear as soon as someone messages one of your numbers."
          />
        ) : (
          <Card className="divide-y divide-[var(--color-border)]">
            {filtered.map((contact) => (
              <Link
                key={contact.id}
                href={`/contacts/${contact.id}`}
                className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--color-surface-2)]"
              >
                <Avatar
                  name={contact.displayName ?? contact.profileName ?? contact.primaryPhone ?? "?"}
                  size={32}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {contact.displayName ??
                      contact.profileName ??
                      displayIdentifier(contact.primaryPhone ?? contact.primaryEmail ?? "")}
                  </p>
                  <p className="truncate text-xs text-[var(--color-muted)]">
                    {[contact.primaryPhone, contact.primaryEmail]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <div className="hidden items-center gap-2 sm:flex">
                  {contact.availableChannels.slice(0, 4).map((channel) => (
                    <ChannelIcon key={channel} channel={channel} withLabel={false} />
                  ))}
                </div>
                <CopyableId id={contact.id} className="hidden md:inline" />
              </Link>
            ))}
          </Card>
        )}

        {nextCursor ? (
          <div className="mt-4 flex justify-center">
            <Link
              href={`/contacts?cursor=${encodeURIComponent(nextCursor)}`}
              className="cursor-pointer text-sm text-[var(--color-signal)] hover:underline"
            >
              Load more
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}
