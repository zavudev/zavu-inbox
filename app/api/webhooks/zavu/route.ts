import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { webhookEvents } from "@/lib/db/schema";
import { publish } from "@/lib/events";
import { maybeSendAutoReply } from "@/lib/auto-reply";
import { syncConversation } from "@/lib/sync";
import { verifyZavuSignature } from "@/lib/zavu/webhook";
import { zavu } from "@/lib/zavu/client";
import type { ZavuInboundMessageData, ZavuWebhookPayload } from "@/lib/zavu/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Point a Zavu sender webhook at POST /api/webhooks/zavu and subscribe to
 * message.inbound, message.sent, message.delivered, message.read,
 * message.failed and conversation.new.
 *
 * Contract with Zavu's retry logic: return 2xx once the event is durably
 * recorded. Anything else is retried with backoff, so a 500 here is a real
 * "try again", not a shrug.
 */
export async function POST(request: Request) {
  const secret = process.env.ZAVU_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[webhooks] ZAVU_WEBHOOK_SECRET is not set; refusing to accept events.");
    return NextResponse.json({ error: "not_configured" }, { status: 500 });
  }

  // Must read the raw body: re-serializing JSON changes the bytes the
  // signature was computed over.
  const rawBody = await request.text();

  const result = verifyZavuSignature(
    rawBody,
    request.headers.get("x-zavu-signature"),
    secret
  );
  if (!result.valid) {
    console.warn(`[webhooks] rejected delivery: ${result.reason}`);
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  let payload: ZavuWebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  // Idempotency: the insert is the lock. A duplicate delivery conflicts and is
  // acknowledged without being processed twice.
  const inserted = await db
    .insert(webhookEvents)
    .values({ id: payload.id, type: payload.type })
    .onConflictDoNothing()
    .returning({ id: webhookEvents.id });

  if (inserted.length === 0) {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  try {
    await handleEvent(payload);
  } catch (error) {
    // Roll back the idempotency marker so Zavu's retry can actually retry.
    await db.delete(webhookEvents).where(eq(webhookEvents.id, payload.id));
    console.error(`[webhooks] failed handling ${payload.type}`, error);
    return NextResponse.json({ error: "handler_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

async function handleEvent(payload: ZavuWebhookPayload): Promise<void> {
  switch (payload.type) {
    case "message.inbound": {
      const data = payload.data as unknown as ZavuInboundMessageData;
      const conversationId = await resolveConversationId(data);
      if (!conversationId) return;

      await syncConversation(conversationId, { reopenOnInbound: true });
      publish({
        type: "message.received",
        conversationId,
        messageId: data.messageId,
      });

      // Best effort: a failed auto-reply must not make Zavu retry the whole
      // delivery, which would double-sync the thread.
      try {
        await maybeSendAutoReply(conversationId);
      } catch (error) {
        console.error("[webhooks] auto-reply failed", error);
      }
      return;
    }

    case "conversation.new": {
      const conversationId = payload.data.conversationId as string | undefined;
      if (!conversationId) return;

      await syncConversation(conversationId);
      publish({ type: "conversation.created", conversationId });
      return;
    }

    case "message.queued":
    case "message.sent":
    case "message.delivered":
    case "message.read":
    case "message.failed": {
      const data = payload.data as unknown as ZavuInboundMessageData;
      const conversationId = await resolveConversationId(data);
      if (!conversationId) return;

      // Outbound status changes move the preview and the delivery ticks, so the
      // thread row is refreshed too.
      await syncConversation(conversationId);
      publish({
        type: "message.status",
        conversationId,
        messageId: data.messageId,
        status: data.status,
      });
      return;
    }

    default:
      // Unknown event types are acknowledged: failing them would make Zavu
      // retry something this app will never understand.
      return;
  }
}

/**
 * `conversationId` is null on the first message of a brand-new thread. The
 * message itself always has it, so fall back to fetching the message rather
 * than guessing by phone number, which breaks on BSUIDs and chat IDs.
 */
async function resolveConversationId(
  data: ZavuInboundMessageData
): Promise<string | null> {
  if (data.conversationId) return data.conversationId;
  if (!data.messageId) return null;

  const message = await zavu().messages.get(data.messageId);
  return message.conversationId ?? null;
}
