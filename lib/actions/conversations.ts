"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  comments,
  conversationEvents,
  conversations,
  mentions,
  users,
} from "@/lib/db/schema";
import { requireUser } from "@/lib/auth/session";
import { publish } from "@/lib/events";
import { newId } from "@/lib/utils";
import { syncConversation } from "@/lib/sync";
import { zavu, ZavuApiError } from "@/lib/zavu/client";

export type ActionResult = { ok: true } | { ok: false; error: string };

async function loadConversation(conversationId: string) {
  const rows = await db
    .select()
    .from(conversations)
    .where(eq(conversations.zavuId, conversationId))
    .limit(1);

  const conversation = rows[0];
  if (!conversation) throw new Error("Conversation not found.");
  return conversation;
}

function touch(conversationId: string) {
  revalidatePath("/inbox");
  revalidatePath(`/inbox/${conversationId}`);
  publish({ type: "conversation.updated", conversationId });
}

// ---------------------------------------------------------------------------
// Assignment and status
// ---------------------------------------------------------------------------

export async function assignConversation(
  conversationId: string,
  assigneeId: string | null
): Promise<ActionResult> {
  const user = await requireUser();
  await loadConversation(conversationId);

  await db
    .update(conversations)
    .set({ assigneeId, lastActivityAt: new Date() })
    .where(eq(conversations.zavuId, conversationId));

  await db.insert(conversationEvents).values({
    id: newId("cev"),
    conversationId,
    type: assigneeId ? "assigned" : "unassigned",
    actorId: user.id,
    targetUserId: assigneeId,
  });

  touch(conversationId);
  return { ok: true };
}

export async function setConversationStatus(
  conversationId: string,
  status: "open" | "done"
): Promise<ActionResult> {
  const user = await requireUser();
  await loadConversation(conversationId);

  await db
    .update(conversations)
    .set({ status, snoozedUntil: null, lastActivityAt: new Date() })
    .where(eq(conversations.zavuId, conversationId));

  await db.insert(conversationEvents).values({
    id: newId("cev"),
    conversationId,
    type: "status_changed",
    actorId: user.id,
    value: status,
  });

  touch(conversationId);
  return { ok: true };
}

export async function snoozeConversation(
  conversationId: string,
  until: Date
): Promise<ActionResult> {
  const user = await requireUser();
  await loadConversation(conversationId);

  if (until.getTime() <= Date.now()) {
    return { ok: false, error: "Pick a time in the future." };
  }

  await db
    .update(conversations)
    .set({ status: "snoozed", snoozedUntil: until, lastActivityAt: new Date() })
    .where(eq(conversations.zavuId, conversationId));

  await db.insert(conversationEvents).values({
    id: newId("cev"),
    conversationId,
    type: "snoozed",
    actorId: user.id,
    value: until.toISOString(),
  });

  touch(conversationId);
  return { ok: true };
}

export async function markConversationRead(
  conversationId: string
): Promise<ActionResult> {
  await requireUser();

  // Zavu owns the counter, so clear it there and mirror the result. A failure
  // must not leave the local row claiming zero unread, and must not throw
  // either: this fires from an effect the moment a thread is opened, so a bad
  // API key or an unreachable Zavu would blow up every thread the team opens.
  try {
    await zavu().conversations.markRead(conversationId);
  } catch (error) {
    const reason =
      error instanceof ZavuApiError && error.status === 404
        ? "That conversation no longer exists in Zavu."
        : error instanceof Error
          ? error.message
          : "Could not reach Zavu.";

    console.error(`[markRead] ${conversationId}: ${reason}`);
    return { ok: false, error: reason };
  }

  await db
    .update(conversations)
    .set({ unreadCount: 0 })
    .where(eq(conversations.zavuId, conversationId));

  revalidatePath("/inbox");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Internal notes
// ---------------------------------------------------------------------------

/** `@name` mentions are resolved against workspace members, never sent out. */
export async function addComment(
  conversationId: string,
  body: string
): Promise<ActionResult> {
  const user = await requireUser();
  const trimmed = body.trim();
  if (!trimmed) return { ok: false, error: "Write something first." };

  await loadConversation(conversationId);

  const commentId = newId("cmt");
  await db.insert(comments).values({
    id: commentId,
    conversationId,
    userId: user.id,
    body: trimmed,
  });

  const mentioned = await resolveMentions(trimmed, user.id);
  if (mentioned.length > 0) {
    await db
      .insert(mentions)
      .values(mentioned.map((userId) => ({ commentId, userId })));

    for (const userId of mentioned) {
      publish({ type: "mention.created", userId, conversationId });
    }
  }

  await db
    .update(conversations)
    .set({ lastActivityAt: new Date() })
    .where(eq(conversations.zavuId, conversationId));

  revalidatePath(`/inbox/${conversationId}`);
  publish({ type: "comment.created", conversationId, commentId });
  return { ok: true };
}

async function resolveMentions(body: string, authorId: string): Promise<string[]> {
  const handles = [...body.matchAll(/@([\w.-]+)/g)].map((m) => m[1].toLowerCase());
  if (handles.length === 0) return [];

  const members = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users);

  const matched = new Set<string>();
  for (const member of members) {
    if (member.id === authorId) continue; // no self-notifications
    const localPart = member.email.split("@")[0].toLowerCase();
    const firstName = member.name.split(/\s+/)[0]?.toLowerCase() ?? "";
    if (handles.includes(localPart) || (firstName && handles.includes(firstName))) {
      matched.add(member.id);
    }
  }

  return [...matched];
}

export async function markMentionsRead(conversationId: string): Promise<ActionResult> {
  const user = await requireUser();

  const rows = await db
    .select({ id: comments.id })
    .from(comments)
    .where(eq(comments.conversationId, conversationId));

  if (rows.length === 0) return { ok: true };

  await db
    .update(mentions)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(mentions.userId, user.id),
        inArray(
          mentions.commentId,
          rows.map((r) => r.id)
        )
      )
    );

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Sending
// ---------------------------------------------------------------------------

export async function sendReply(input: {
  conversationId: string;
  text: string;
  channel?: string;
  subject?: string;
}): Promise<ActionResult> {
  const user = await requireUser();
  const text = input.text.trim();
  if (!text) return { ok: false, error: "Write something first." };

  const conversation = await loadConversation(input.conversationId);

  // Reply on the channel the thread last used unless the agent picked another,
  // and from the sender the contact already knows.
  const channel = input.channel ?? conversation.lastMessageChannel ?? "sms";
  const isEmail = channel === "email";

  if (isEmail && !input.subject?.trim() && !conversation.email) {
    return { ok: false, error: "Email replies need a subject." };
  }

  try {
    await zavu().messages.send({
      to: isEmail ? conversation.email ?? conversation.contactIdentifier : conversation.contactIdentifier,
      channel: channel === "whatsapp_alt" ? "whatsapp" : channel,
      text,
      subject: isEmail ? input.subject?.trim() || "Re: your message" : undefined,
      senderId: conversation.zavuSenderId ?? undefined,
      // Same author replying with the same text inside a second is a double
      // submit, not two messages.
      idempotencyKey: `zavu_inbox_${input.conversationId}_${user.id}_${Math.floor(
        Date.now() / 1000
      )}`,
    });
  } catch (error) {
    if (error instanceof ZavuApiError) {
      if (error.isWindowClosed) {
        return {
          ok: false,
          error:
            "The WhatsApp 24-hour window is closed. Send an approved template instead.",
        };
      }
      if (error.status === 402) {
        return { ok: false, error: "Zavu balance is empty. Top up to keep sending." };
      }
      if (error.status === 403) {
        return { ok: false, error: error.message };
      }
      return { ok: false, error: error.message };
    }
    throw error;
  }

  // The outbound message changes the preview and ordering; pull the thread back
  // rather than guessing what Zavu recorded. The message is already gone, so a
  // failure here is a stale preview, not a failed send: reporting it as an
  // error would invite someone to send the same thing twice.
  try {
    await syncConversation(input.conversationId);
  } catch (error) {
    console.error(`[sendReply] sent, but re-sync failed: ${String(error)}`);
  }

  touch(input.conversationId);
  return { ok: true };
}

/** Marks the inbound message read and shows a typing bubble while we draft. */
export async function showTyping(messageId: string, senderId?: string): Promise<void> {
  await requireUser();
  try {
    await zavu().messages.typing(messageId, senderId);
  } catch {
    // Cosmetic only: never let this break the reply flow.
  }
}
