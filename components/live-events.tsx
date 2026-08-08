"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

/**
 * Single SSE subscription for the app shell. Server components own the data, so
 * an event just triggers `router.refresh()` and React reconciles the new tree.
 *
 * Refreshes are coalesced: a burst of inbound messages should cost one refresh,
 * not one per message.
 */
export function LiveEvents() {
  const router = useRouter();

  useEffect(() => {
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    let source: EventSource | null = null;
    let retryDelay = 1_000;
    let closed = false;

    const scheduleRefresh = () => {
      if (refreshTimer) return;
      refreshTimer = setTimeout(() => {
        refreshTimer = null;
        router.refresh();
      }, 300);
    };

    const connect = () => {
      if (closed) return;
      source = new EventSource("/api/events");

      source.onopen = () => {
        retryDelay = 1_000;
      };

      source.onmessage = (event) => {
        let payload: { type?: string; conversationId?: string };
        try {
          payload = JSON.parse(event.data);
        } catch {
          return;
        }

        if (payload.type === "connected") return;

        if (payload.type === "mention.created") {
          toast("You were mentioned", {
            action: payload.conversationId
              ? {
                  label: "Open",
                  onClick: () => router.push(`/inbox/${payload.conversationId}`),
                }
              : undefined,
          });
        }

        scheduleRefresh();
      };

      source.onerror = () => {
        source?.close();
        if (closed) return;
        // Back off so a restarting server does not get hammered by every tab.
        setTimeout(connect, retryDelay);
        retryDelay = Math.min(retryDelay * 2, 30_000);
      };
    };

    connect();

    return () => {
      closed = true;
      if (refreshTimer) clearTimeout(refreshTimer);
      source?.close();
    };
  }, [router]);

  return null;
}
