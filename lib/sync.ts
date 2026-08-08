import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { conversations, inboxes } from "@/lib/db/schema";
import { newId } from "@/lib/utils";
import { zavu } from "@/lib/zavu/client";
import type { ZavuConversation, ZavuSender } from "@/lib/zavu/types";

/**
 * Zavu owns threads, messages and contacts. Zavu Inbox mirrors just enough of a
 * thread to sort and filter an inbox locally, and never lets the mirror
 * overwrite workspace state (status, assignee) that Zavu knows nothing about.
 */

export async function upsertConversation(
  conv: ZavuConversation,
  options?: { reopenOnInbound?: boolean }
): Promise<void> {
  const inboxId = conv.senderId ? await inboxIdForSender(conv.senderId) : null;
  const lastMessageAt = new Date(conv.lastMessage.at);

  const shouldReopen =
    options?.reopenOnInbound === true && conv.lastMessage.direction === "inbound";

  await db
    .insert(conversations)
    .values({
      zavuId: conv.id,
      inboxId,
      zavuSenderId: conv.senderId ?? null,
      contactIdentifier: conv.contactIdentifier,
      email: conv.email ?? null,
      zavuContactId: conv.contactId ?? null,
      contactName: conv.group?.subject ?? conv.whatsapp?.username ?? null,
      channels: conv.channels,
      lastMessageText: conv.lastMessage.text,
      lastMessageChannel: conv.lastMessage.channel,
      lastMessageDirection: conv.lastMessage.direction,
      lastMessageAt,
      messageCount: conv.messageCount,
      unreadCount: conv.unreadCount,
      isGroup: Boolean(conv.group),
      groupSubject: conv.group?.subject ?? null,
      whatsappUsername: conv.whatsapp?.username ?? null,
      lastActivityAt: lastMessageAt,
      syncedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: conversations.zavuId,
      set: {
        // Mirrored fields only. `status` and `assigneeId` are deliberately
        // absent: a sync must never silently unassign a thread.
        inboxId,
        zavuSenderId: conv.senderId ?? null,
        contactIdentifier: conv.contactIdentifier,
        email: conv.email ?? null,
        zavuContactId: conv.contactId ?? null,
        channels: conv.channels,
        lastMessageText: conv.lastMessage.text,
        lastMessageChannel: conv.lastMessage.channel,
        lastMessageDirection: conv.lastMessage.direction,
        lastMessageAt,
        messageCount: conv.messageCount,
        unreadCount: conv.unreadCount,
        isGroup: Boolean(conv.group),
        groupSubject: conv.group?.subject ?? null,
        whatsappUsername: conv.whatsapp?.username ?? null,
        lastActivityAt: lastMessageAt,
        syncedAt: new Date(),
        // A customer who writes again pulls the thread back into the queue.
        // Without this a resolved thread would stay hidden with a fresh
        // unanswered message inside it.
        ...(shouldReopen ? { status: "open" as const, snoozedUntil: null } : {}),
      },
    });
}

export async function syncConversation(
  conversationId: string,
  options?: { reopenOnInbound?: boolean }
): Promise<void> {
  const { conversation } = await zavu().conversations.get(conversationId);
  await upsertConversation(conversation, options);
}

/**
 * Full import. Run once at setup and whenever an operator suspects drift;
 * webhooks keep things current the rest of the time.
 */
export async function syncAllConversations(): Promise<number> {
  const all = await zavu().conversations.listAll();
  for (const conv of all) {
    await upsertConversation(conv);
  }
  return all.length;
}

/** Mirrors Zavu senders into inboxes. Existing rows keep their local settings. */
export async function syncInboxes(): Promise<ZavuSender[]> {
  const { items } = await zavu().senders.list({ limit: 100 });

  for (const sender of items) {
    await db
      .insert(inboxes)
      .values({
        id: newId("ibx"),
        zavuSenderId: sender.id,
        name: sender.name,
        phoneNumber: sender.phoneNumber ?? null,
        emailAddress: sender.emailAddress ?? null,
        channels: sender.channels ?? [],
      })
      .onConflictDoUpdate({
        target: inboxes.zavuSenderId,
        set: {
          // Name is intentionally not overwritten: an operator may have renamed
          // the inbox to something their team uses.
          phoneNumber: sender.phoneNumber ?? null,
          emailAddress: sender.emailAddress ?? null,
          channels: sender.channels ?? [],
        },
      });
  }

  return items;
}

const inboxCache = new Map<string, string>();

async function inboxIdForSender(zavuSenderId: string): Promise<string | null> {
  const cached = inboxCache.get(zavuSenderId);
  if (cached) return cached;

  const rows = await db
    .select({ id: inboxes.id })
    .from(inboxes)
    .where(eq(inboxes.zavuSenderId, zavuSenderId))
    .limit(1);

  if (rows[0]) {
    inboxCache.set(zavuSenderId, rows[0].id);
    return rows[0].id;
  }

  // A sender connected in Zavu after setup. Create its inbox rather than
  // dropping the thread into an unfiled state nobody looks at.
  const created = await db
    .insert(inboxes)
    .values({
      id: newId("ibx"),
      zavuSenderId,
      name: zavuSenderId,
      channels: [],
    })
    .onConflictDoNothing()
    .returning({ id: inboxes.id });

  if (created[0]) {
    inboxCache.set(zavuSenderId, created[0].id);
    return created[0].id;
  }

  const existing = await db
    .select({ id: inboxes.id })
    .from(inboxes)
    .where(eq(inboxes.zavuSenderId, zavuSenderId))
    .limit(1);

  const id = existing[0]?.id ?? null;
  if (id) inboxCache.set(zavuSenderId, id);
  return id;
}
