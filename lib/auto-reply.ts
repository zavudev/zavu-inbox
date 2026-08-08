import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { conversations, inboxes } from "@/lib/db/schema";
import { closedPeriodStart, isWithinBusinessHours } from "@/lib/business-hours";
import { zavu } from "@/lib/zavu/client";

/**
 * Out-of-hours auto-reply. Runs on inbound messages only, sends at most once
 * per conversation per closed period, and stays silent whenever anything is
 * uncertain: a duplicate "we are closed" to a customer is worse than none.
 */
export async function maybeSendAutoReply(conversationId: string): Promise<void> {
  const rows = await db
    .select({ conversation: conversations, inbox: inboxes })
    .from(conversations)
    .innerJoin(inboxes, eq(conversations.inboxId, inboxes.id))
    .where(eq(conversations.zavuId, conversationId))
    .limit(1);

  const row = rows[0];
  if (!row) return;

  const { conversation, inbox } = row;

  if (!inbox.awayMessageEnabled) return;
  if (!inbox.awayMessage?.trim()) return;
  if (isWithinBusinessHours(inbox.businessHours, inbox.timezone)) return;

  // Voice threads have no text channel to answer on.
  const channel = conversation.lastMessageChannel;
  if (!channel || channel === "voice") return;

  const periodStart = closedPeriodStart(inbox.businessHours, inbox.timezone);
  if (conversation.lastAutoReplyAt) {
    const alreadyRepliedThisPeriod = periodStart
      ? conversation.lastAutoReplyAt >= periodStart
      : // No period boundary (a schedule that never opens): fall back to a
        // daily cap so a contact is not answered on every message forever.
        Date.now() - conversation.lastAutoReplyAt.getTime() < 24 * 60 * 60 * 1000;

    if (alreadyRepliedThisPeriod) return;
  }

  // Claim the slot before sending. Two near-simultaneous inbound messages would
  // otherwise both pass the check above and send two replies.
  const claimed = await db
    .update(conversations)
    .set({ lastAutoReplyAt: new Date() })
    .where(eq(conversations.zavuId, conversationId))
    .returning({ zavuId: conversations.zavuId });

  if (claimed.length === 0) return;

  try {
    await zavu().messages.send({
      to:
        channel === "email"
          ? conversation.email ?? conversation.contactIdentifier
          : conversation.contactIdentifier,
      channel: channel === "whatsapp_alt" ? "whatsapp" : channel,
      text: inbox.awayMessage,
      subject: channel === "email" ? "Thanks for writing" : undefined,
      senderId: conversation.zavuSenderId ?? undefined,
    });
  } catch (error) {
    // Give the slot back so the next inbound message can try again.
    await db
      .update(conversations)
      .set({ lastAutoReplyAt: conversation.lastAutoReplyAt })
      .where(eq(conversations.zavuId, conversationId));
    console.error("[auto-reply] send failed", error);
  }
}
