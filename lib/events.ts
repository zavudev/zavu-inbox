import "server-only";

/**
 * In-process pub/sub behind the SSE endpoint. Good enough for a self-hosted
 * instance on one node, which is the shape almost every Zavu Inbox deployment has.
 *
 * Scaling past one node means swapping this for Postgres LISTEN/NOTIFY or
 * Redis. `publish` and `subscribe` are the only surface to reimplement; nothing
 * else in the app touches the transport.
 */

export type InboxEvent =
  | { type: "conversation.updated"; conversationId: string }
  | { type: "conversation.created"; conversationId: string }
  | { type: "message.received"; conversationId: string; messageId: string }
  | { type: "message.status"; conversationId: string; messageId: string; status: string }
  | { type: "comment.created"; conversationId: string; commentId: string }
  | { type: "mention.created"; userId: string; conversationId: string };

type Listener = (event: InboxEvent) => void;

const globalForBus = globalThis as unknown as { zavuInboxListeners?: Set<Listener> };
const listeners = (globalForBus.zavuInboxListeners ??= new Set<Listener>());

export function publish(event: InboxEvent): void {
  for (const listener of listeners) {
    try {
      listener(event);
    } catch {
      // A dead stream must not take down the publisher.
    }
  }
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
