import { getCurrentUser } from "@/lib/auth/session";
import { subscribe } from "@/lib/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Server-sent events feed. The inbox subscribes once and refreshes the rows an
 * event touches, which keeps a shared inbox live without websockets or a
 * polling loop hammering the Zavu API.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (data: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      send({ type: "connected" });

      const unsubscribe = subscribe((event) => {
        // Mentions are addressed to one person; everything else is workspace
        // wide and every open tab wants it.
        if (event.type === "mention.created" && event.userId !== user.id) return;
        send(event);
      });

      // Proxies drop idle connections; a comment line every 25s keeps the
      // stream open without showing up as an event client side.
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": keepalive\n\n"));
        } catch {
          clearInterval(heartbeat);
        }
      }, 25_000);

      request.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // Already closed by the client going away.
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Nginx buffers SSE into uselessness without this.
      "X-Accel-Buffering": "no",
    },
  });
}
