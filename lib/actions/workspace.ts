"use server";

import { revalidatePath } from "next/cache";
import { and, eq, or } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  contactNotes,
  contactProperties,
  conversations,
  inboxes,
  scheduledMessages,
  snippets,
  tasks,
  workspace,
} from "@/lib/db/schema";
import { requireAdmin, requireUser } from "@/lib/auth/session";
import { newId } from "@/lib/utils";
import { syncAllConversations, syncInboxes } from "@/lib/sync";
import type { BusinessHours } from "@/lib/db/schema";
import type { ActionResult } from "./conversations";

// ---------------------------------------------------------------------------
// Snippets
// ---------------------------------------------------------------------------

export async function createSnippet(input: {
  shortcut: string;
  body: string;
  shared: boolean;
}): Promise<ActionResult> {
  const user = await requireUser();

  const shortcut = input.shortcut.trim().replace(/^\//, "").toLowerCase();
  if (!shortcut) return { ok: false, error: "Give the snippet a shortcut." };
  if (!/^[a-z0-9-]+$/.test(shortcut)) {
    return { ok: false, error: "Shortcuts can use letters, numbers and dashes only." };
  }
  if (!input.body.trim()) return { ok: false, error: "Write the snippet text." };

  await db.insert(snippets).values({
    id: newId("snp"),
    shortcut,
    body: input.body.trim(),
    shared: input.shared,
    createdBy: user.id,
  });

  revalidatePath("/settings/snippets");
  return { ok: true };
}

export async function deleteSnippet(id: string): Promise<ActionResult> {
  const user = await requireUser();

  // Members can delete their own; admins can delete anything shared.
  const condition =
    user.role === "member"
      ? and(eq(snippets.id, id), eq(snippets.createdBy, user.id))
      : eq(snippets.id, id);

  await db.delete(snippets).where(condition);
  revalidatePath("/settings/snippets");
  return { ok: true };
}

/**
 * Every export in a "use server" file is a callable endpoint, so this resolves
 * the user from the session and ignores any caller-supplied id. Taking one on
 * trust would let an unauthenticated POST read another person's snippets.
 */
export async function listSnippetsFor(_userId?: string) {
  const user = await requireUser();

  return db
    .select()
    .from(snippets)
    .where(or(eq(snippets.shared, true), eq(snippets.createdBy, user.id)));
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

export async function createTask(input: {
  title: string;
  conversationId?: string;
  assigneeId?: string;
  dueAt?: string;
}): Promise<ActionResult> {
  const user = await requireUser();
  const title = input.title.trim();
  if (!title) return { ok: false, error: "Give the task a title." };

  await db.insert(tasks).values({
    id: newId("tsk"),
    title,
    conversationId: input.conversationId ?? null,
    assigneeId: input.assigneeId ?? user.id,
    dueAt: input.dueAt ? new Date(input.dueAt) : null,
    createdBy: user.id,
  });

  revalidatePath("/tasks");
  if (input.conversationId) revalidatePath(`/inbox/${input.conversationId}`);
  return { ok: true };
}

export async function toggleTask(id: string): Promise<ActionResult> {
  await requireUser();

  const rows = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
  const task = rows[0];
  if (!task) return { ok: false, error: "Task not found." };

  await db
    .update(tasks)
    .set({ completedAt: task.completedAt ? null : new Date() })
    .where(eq(tasks.id, id));

  revalidatePath("/tasks");
  if (task.conversationId) revalidatePath(`/inbox/${task.conversationId}`);
  return { ok: true };
}

export async function deleteTask(id: string): Promise<ActionResult> {
  await requireUser();
  await db.delete(tasks).where(eq(tasks.id, id));
  revalidatePath("/tasks");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Scheduled messages
// ---------------------------------------------------------------------------

export async function scheduleMessage(input: {
  conversationId: string;
  text: string;
  sendAt: string;
  channel?: string;
  subject?: string;
}): Promise<ActionResult> {
  const user = await requireUser();

  const text = input.text.trim();
  if (!text) return { ok: false, error: "Write the message first." };

  const sendAt = new Date(input.sendAt);
  if (Number.isNaN(sendAt.getTime())) return { ok: false, error: "That date is not valid." };
  if (sendAt.getTime() <= Date.now()) return { ok: false, error: "Pick a time in the future." };

  const rows = await db
    .select()
    .from(conversations)
    .where(eq(conversations.zavuId, input.conversationId))
    .limit(1);

  const conversation = rows[0];
  if (!conversation) return { ok: false, error: "Conversation not found." };

  const channel = input.channel ?? conversation.lastMessageChannel ?? "sms";

  await db.insert(scheduledMessages).values({
    id: newId("sch"),
    conversationId: input.conversationId,
    zavuSenderId: conversation.zavuSenderId,
    to:
      channel === "email"
        ? conversation.email ?? conversation.contactIdentifier
        : conversation.contactIdentifier,
    channel,
    text,
    subject: input.subject ?? null,
    sendAt,
    createdBy: user.id,
  });

  revalidatePath(`/inbox/${input.conversationId}`);
  return { ok: true };
}

export async function cancelScheduledMessage(id: string): Promise<ActionResult> {
  await requireUser();

  // Only a pending message can be cancelled: flipping a sent row to cancelled
  // would claim something that already left.
  await db
    .update(scheduledMessages)
    .set({ status: "cancelled" })
    .where(and(eq(scheduledMessages.id, id), eq(scheduledMessages.status, "pending")));

  revalidatePath("/inbox");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Contact enrichment
// ---------------------------------------------------------------------------

export async function addContactNote(
  zavuContactId: string,
  body: string
): Promise<ActionResult> {
  const user = await requireUser();
  const trimmed = body.trim();
  if (!trimmed) return { ok: false, error: "Write something first." };

  await db.insert(contactNotes).values({
    id: newId("nte"),
    zavuContactId,
    body: trimmed,
    createdBy: user.id,
  });

  revalidatePath(`/contacts/${zavuContactId}`);
  return { ok: true };
}

export async function setContactProperty(
  zavuContactId: string,
  key: string,
  value: string
): Promise<ActionResult> {
  await requireUser();
  const trimmedKey = key.trim();
  if (!trimmedKey) return { ok: false, error: "Give the property a name." };

  if (!value.trim()) {
    await db
      .delete(contactProperties)
      .where(
        and(
          eq(contactProperties.zavuContactId, zavuContactId),
          eq(contactProperties.key, trimmedKey)
        )
      );
  } else {
    await db
      .insert(contactProperties)
      .values({ zavuContactId, key: trimmedKey, value: value.trim() })
      .onConflictDoUpdate({
        target: [contactProperties.zavuContactId, contactProperties.key],
        set: { value: value.trim(), updatedAt: new Date() },
      });
  }

  revalidatePath(`/contacts/${zavuContactId}`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Inbox settings
// ---------------------------------------------------------------------------

export async function updateInbox(
  inboxId: string,
  input: {
    name?: string;
    timezone?: string;
    businessHours?: BusinessHours | null;
    awayMessage?: string | null;
    awayMessageEnabled?: boolean;
  }
): Promise<ActionResult> {
  await requireAdmin();

  await db
    .update(inboxes)
    .set({
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.timezone !== undefined ? { timezone: input.timezone } : {}),
      ...(input.businessHours !== undefined ? { businessHours: input.businessHours } : {}),
      ...(input.awayMessage !== undefined ? { awayMessage: input.awayMessage } : {}),
      ...(input.awayMessageEnabled !== undefined
        ? { awayMessageEnabled: input.awayMessageEnabled }
        : {}),
    })
    .where(eq(inboxes.id, inboxId));

  revalidatePath("/settings/inboxes");
  return { ok: true };
}

/** Re-import from Zavu. For drift after downtime or a missed webhook. */
export async function resyncFromZavu(): Promise<ActionResult> {
  await requireAdmin();

  try {
    await syncInboxes();
    const count = await syncAllConversations();
    await db
      .update(workspace)
      .set({ lastSyncAt: new Date() })
      .where(eq(workspace.id, "workspace"));

    revalidatePath("/inbox");
    revalidatePath("/settings");
    console.log(`[resync] refreshed ${count} conversations.`);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Sync failed.",
    };
  }
}
