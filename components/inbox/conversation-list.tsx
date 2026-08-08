"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { formatDistanceToNowStrict } from "date-fns";
import { Search } from "lucide-react";
import { cn, displayIdentifier } from "@/lib/utils";
import { Avatar, Badge, EmptyState, Input } from "@/components/ui/primitives";
import { ChannelIcon } from "./channel-icon";
import type { ConversationRow } from "@/lib/queries";

export function ConversationList({
  items,
  currentUserId,
}: {
  items: ConversationRow[];
  currentUserId: string;
}) {
  const params = useParams<{ conversationId?: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");

  // Debounced search: typing should not fire a query per keystroke.
  useEffect(() => {
    const current = searchParams.get("q") ?? "";
    if (query === current) return;

    const timer = setTimeout(() => {
      const next = new URLSearchParams(searchParams.toString());
      if (query.trim()) next.set("q", query.trim());
      else next.delete("q");
      router.replace(`/inbox?${next.toString()}`);
    }, 250);

    return () => clearTimeout(timer);
  }, [query, router, searchParams]);

  const viewLabel = searchParams.get("view") ?? (searchParams.get("inbox") ? "all" : "open");

  return (
    <div className="flex w-full shrink-0 flex-col border-r border-[var(--color-border)] lg:w-96">
      <div className="flex h-14 items-center gap-2 border-b border-[var(--color-border)] px-3">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-[var(--color-muted)]" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search conversations"
            className="h-8 pl-8 text-sm"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
        {items.length === 0 ? (
          <EmptyState
            title={query ? "Nothing matches that" : `No ${viewLabel} conversations`}
            description={
              query
                ? "Try a phone number, an email, or a word from the message."
                : "New messages land here as soon as Zavu receives them."
            }
          />
        ) : (
          <ul>
            {items.map((item) => (
              <ConversationRowItem
                key={item.zavuId}
                item={item}
                selected={params.conversationId === item.zavuId}
                currentUserId={currentUserId}
                search={searchParams.toString()}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function ConversationRowItem({
  item,
  selected,
  currentUserId,
  search,
}: {
  item: ConversationRow;
  selected: boolean;
  currentUserId: string;
  search: string;
}) {
  const unread = item.unreadCount > 0;
  const name = item.isGroup
    ? item.groupSubject ?? "Group chat"
    : displayIdentifier(item.contactIdentifier, item.contactName);

  return (
    <li>
      <Link
        href={`/inbox/${item.zavuId}${search ? `?${search}` : ""}`}
        className={cn(
          "flex gap-3 border-b border-[var(--color-border)] px-3 py-3 transition-colors",
          selected
            ? "bg-[var(--color-surface-2)]"
            : "hover:bg-[var(--color-surface-2)]/60"
        )}
      >
        <div className="relative shrink-0 pt-0.5">
          <Avatar name={name} color="violet" size={32} />
          {unread ? (
            <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-[var(--color-signal)] ring-2 ring-[var(--color-surface)]" />
          ) : null}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <p className={cn("truncate text-sm", unread ? "font-semibold" : "font-medium")}>
              {name}
            </p>
            <time className="ml-auto shrink-0 text-[11px] text-[var(--color-muted)]">
              {formatDistanceToNowStrict(item.lastMessageAt, { addSuffix: false })}
            </time>
          </div>

          <p
            className={cn(
              "mt-0.5 line-clamp-2 text-[13px]",
              unread ? "text-[var(--color-fg)]" : "text-[var(--color-muted)]"
            )}
          >
            {item.lastMessageDirection === "outbound" ? (
              <span className="text-[var(--color-muted)]">You: </span>
            ) : null}
            {item.lastMessageText || <span className="italic">Media message</span>}
          </p>

          <div className="mt-1.5 flex items-center gap-1.5">
            {item.lastMessageChannel ? (
              <ChannelIcon channel={item.lastMessageChannel} />
            ) : null}
            {item.inboxName ? (
              <span className="label-mono truncate">{item.inboxName}</span>
            ) : null}
            {item.status === "snoozed" ? <Badge tone="warning">Snoozed</Badge> : null}
            {item.assigneeId ? (
              <span className="ml-auto">
                <Avatar
                  name={item.assigneeName ?? "?"}
                  color={item.assigneeColor ?? "violet"}
                  size={18}
                  className={
                    item.assigneeId === currentUserId
                      ? "ring-1 ring-[var(--color-signal)]"
                      : undefined
                  }
                />
              </span>
            ) : null}
          </div>
        </div>
      </Link>
    </li>
  );
}
