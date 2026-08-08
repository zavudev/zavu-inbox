import "server-only";
import { and, asc, count, desc, eq, inArray, isNull, lte, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { jsonArrayContains, likeInsensitive } from "@/lib/db/dialect";
import {
  comments,
  conversationEvents,
  conversations,
  inboxes,
  mentions,
  scheduledMessages,
  tasks,
  users,
} from "@/lib/db/schema";

export type InboxFilter = {
  view?: "open" | "done" | "mine" | "unassigned" | "all";
  inboxId?: string;
  channel?: string;
  search?: string;
  limit?: number;
};

export type ConversationRow = Awaited<ReturnType<typeof listConversations>>[number];

export async function listConversations(userId: string, filter: InboxFilter = {}) {
  const conditions = [];

  switch (filter.view ?? "open") {
    case "open":
      // A snoozed thread is not open until its time comes, at which point it
      // shows up here without anyone having to un-snooze it by hand.
      conditions.push(
        or(
          eq(conversations.status, "open"),
          and(
            eq(conversations.status, "snoozed"),
            lte(conversations.snoozedUntil, new Date())
          )
        )
      );
      break;
    case "done":
      conditions.push(eq(conversations.status, "done"));
      break;
    case "mine":
      conditions.push(
        and(eq(conversations.assigneeId, userId), eq(conversations.status, "open"))
      );
      break;
    case "unassigned":
      conditions.push(
        and(isNull(conversations.assigneeId), eq(conversations.status, "open"))
      );
      break;
    case "all":
      break;
  }

  if (filter.inboxId) conditions.push(eq(conversations.inboxId, filter.inboxId));

  if (filter.channel) {
    // `channels` is a JSON array (jsonb in Postgres, text in SQLite), so the
    // match goes through the dialect helper rather than a `@>` that only one
    // of the two backends understands.
    conditions.push(jsonArrayContains(conversations.channels, filter.channel));
  }

  if (filter.search?.trim()) {
    const term = `%${filter.search.trim()}%`;
    conditions.push(
      or(
        likeInsensitive(conversations.contactIdentifier, term),
        likeInsensitive(conversations.contactName, term),
        likeInsensitive(conversations.email, term),
        likeInsensitive(conversations.lastMessageText, term)
      )
    );
  }

  return db
    .select({
      zavuId: conversations.zavuId,
      contactIdentifier: conversations.contactIdentifier,
      contactName: conversations.contactName,
      email: conversations.email,
      zavuContactId: conversations.zavuContactId,
      channels: conversations.channels,
      lastMessageText: conversations.lastMessageText,
      lastMessageChannel: conversations.lastMessageChannel,
      lastMessageDirection: conversations.lastMessageDirection,
      lastMessageAt: conversations.lastMessageAt,
      unreadCount: conversations.unreadCount,
      status: conversations.status,
      snoozedUntil: conversations.snoozedUntil,
      isGroup: conversations.isGroup,
      groupSubject: conversations.groupSubject,
      inboxId: conversations.inboxId,
      inboxName: inboxes.name,
      assigneeId: conversations.assigneeId,
      assigneeName: users.name,
      assigneeColor: users.avatarColor,
    })
    .from(conversations)
    .leftJoin(inboxes, eq(conversations.inboxId, inboxes.id))
    .leftJoin(users, eq(conversations.assigneeId, users.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(conversations.lastMessageAt))
    .limit(filter.limit ?? 100);
}

export async function getConversation(zavuId: string) {
  const rows = await db
    .select({
      conversation: conversations,
      inboxName: inboxes.name,
      inboxChannels: inboxes.channels,
      assigneeName: users.name,
      assigneeColor: users.avatarColor,
    })
    .from(conversations)
    .leftJoin(inboxes, eq(conversations.inboxId, inboxes.id))
    .leftJoin(users, eq(conversations.assigneeId, users.id))
    .where(eq(conversations.zavuId, zavuId))
    .limit(1);

  return rows[0] ?? null;
}

/**
 * Internal notes and assignment events, merged into one timeline so the thread
 * reads in the order things actually happened.
 */
export async function getConversationActivity(conversationId: string) {
  const [notes, events] = await Promise.all([
    db
      .select({
        id: comments.id,
        body: comments.body,
        createdAt: comments.createdAt,
        userId: comments.userId,
        userName: users.name,
        userColor: users.avatarColor,
      })
      .from(comments)
      .leftJoin(users, eq(comments.userId, users.id))
      .where(eq(comments.conversationId, conversationId))
      .orderBy(asc(comments.createdAt)),

    db
      .select({
        id: conversationEvents.id,
        type: conversationEvents.type,
        value: conversationEvents.value,
        createdAt: conversationEvents.createdAt,
        actorName: users.name,
        targetUserId: conversationEvents.targetUserId,
      })
      .from(conversationEvents)
      .leftJoin(users, eq(conversationEvents.actorId, users.id))
      .where(eq(conversationEvents.conversationId, conversationId))
      .orderBy(asc(conversationEvents.createdAt)),
  ]);

  const targetIds = events.map((e) => e.targetUserId).filter((id): id is string => !!id);
  const targets =
    targetIds.length > 0
      ? await db
          .select({ id: users.id, name: users.name })
          .from(users)
          .where(inArray(users.id, targetIds))
      : [];
  const targetNames = new Map(targets.map((t) => [t.id, t.name]));

  return {
    notes,
    events: events.map((e) => ({
      ...e,
      targetName: e.targetUserId ? targetNames.get(e.targetUserId) ?? null : null,
    })),
  };
}

export async function listMembers() {
  return db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      avatarColor: users.avatarColor,
      deactivatedAt: users.deactivatedAt,
    })
    .from(users)
    .where(isNull(users.deactivatedAt))
    .orderBy(asc(users.name));
}

export async function listInboxes() {
  return db
    .select()
    .from(inboxes)
    .where(isNull(inboxes.archivedAt))
    .orderBy(asc(inboxes.name));
}

export async function getInboxCounts(userId: string) {
  const [open, mine, unassigned] = await Promise.all([
    db
      .select({ value: count() })
      .from(conversations)
      .where(eq(conversations.status, "open")),
    db
      .select({ value: count() })
      .from(conversations)
      .where(
        and(eq(conversations.assigneeId, userId), eq(conversations.status, "open"))
      ),
    db
      .select({ value: count() })
      .from(conversations)
      .where(and(isNull(conversations.assigneeId), eq(conversations.status, "open"))),
  ]);

  return {
    open: open[0]?.value ?? 0,
    mine: mine[0]?.value ?? 0,
    unassigned: unassigned[0]?.value ?? 0,
  };
}

export async function countUnreadMentions(userId: string): Promise<number> {
  const rows = await db
    .select({ value: count() })
    .from(mentions)
    .where(and(eq(mentions.userId, userId), isNull(mentions.readAt)));
  return rows[0]?.value ?? 0;
}

export async function listPendingScheduled(conversationId: string) {
  return db
    .select()
    .from(scheduledMessages)
    .where(
      and(
        eq(scheduledMessages.conversationId, conversationId),
        eq(scheduledMessages.status, "pending")
      )
    )
    .orderBy(asc(scheduledMessages.sendAt));
}

export async function listTasks(userId: string, options?: { includeDone?: boolean }) {
  const conditions = [eq(tasks.assigneeId, userId)];
  if (!options?.includeDone) conditions.push(isNull(tasks.completedAt));

  return db
    .select({
      id: tasks.id,
      title: tasks.title,
      dueAt: tasks.dueAt,
      completedAt: tasks.completedAt,
      conversationId: tasks.conversationId,
      contactIdentifier: conversations.contactIdentifier,
      contactName: conversations.contactName,
    })
    .from(tasks)
    .leftJoin(conversations, eq(tasks.conversationId, conversations.zavuId))
    .where(and(...conditions))
    .orderBy(asc(tasks.dueAt), desc(tasks.createdAt));
}

export async function listConversationTasks(conversationId: string) {
  return db
    .select({
      id: tasks.id,
      title: tasks.title,
      dueAt: tasks.dueAt,
      completedAt: tasks.completedAt,
      assigneeName: users.name,
    })
    .from(tasks)
    .leftJoin(users, eq(tasks.assigneeId, users.id))
    .where(eq(tasks.conversationId, conversationId))
    .orderBy(asc(tasks.completedAt), asc(tasks.dueAt));
}
