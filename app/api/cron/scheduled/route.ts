import { NextResponse } from "next/server";
import { and, eq, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import { scheduledMessages } from "@/lib/db/schema";
import { syncConversation } from "@/lib/sync";
import { zavu } from "@/lib/zavu/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BATCH_SIZE = 25;

/**
 * Sends messages whose time has come. Call it on a schedule: the compose file
 * ships a one-minute ticker, and a Vercel deployment can point a cron here.
 *
 * Protected by CRON_SECRET so a public URL cannot be used to flush the queue.
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not set" }, { status: 500 });
  }

  const provided =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    new URL(request.url).searchParams.get("secret");

  if (provided !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const due = await db
    .select()
    .from(scheduledMessages)
    .where(
      and(
        eq(scheduledMessages.status, "pending"),
        lte(scheduledMessages.sendAt, new Date())
      )
    )
    .limit(BATCH_SIZE);

  let sent = 0;
  let failed = 0;

  for (const message of due) {
    // Claim first: two overlapping ticks must not send the same message twice.
    const claimed = await db
      .update(scheduledMessages)
      .set({ status: "sent" })
      .where(
        and(
          eq(scheduledMessages.id, message.id),
          eq(scheduledMessages.status, "pending")
        )
      )
      .returning({ id: scheduledMessages.id });

    if (claimed.length === 0) continue;

    try {
      const result = await zavu().messages.send({
        to: message.to,
        channel: message.channel === "whatsapp_alt" ? "whatsapp" : message.channel,
        text: message.text,
        subject: message.subject ?? undefined,
        senderId: message.zavuSenderId ?? undefined,
        // Stable across retries: the row id is the natural idempotency key.
        idempotencyKey: `zavu_inbox_sched_${message.id}`,
      });

      await db
        .update(scheduledMessages)
        .set({ zavuMessageId: result.id })
        .where(eq(scheduledMessages.id, message.id));

      await syncConversation(message.conversationId);
      sent++;
    } catch (error) {
      // Mark failed rather than reverting to pending: a message that could not
      // be sent at its time should not surprise someone hours later.
      await db
        .update(scheduledMessages)
        .set({
          status: "failed",
          error: error instanceof Error ? error.message : "Unknown error",
        })
        .where(eq(scheduledMessages.id, message.id));
      failed++;
    }
  }

  return NextResponse.json({ processed: due.length, sent, failed });
}
