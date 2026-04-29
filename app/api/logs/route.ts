import { recentLogs, subscribe, type LogEntry } from "@/lib/logs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Server-Sent Events stream. Sends a snapshot of recent logs on connect,
 * then pushes new entries as they arrive.
 */
export async function GET(req: Request) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };

      send("snapshot", recentLogs(200));

      const onEntry = (e: LogEntry) => send("log", e);
      const unsub = subscribe(onEntry);

      // Heartbeat keeps proxies from closing the connection.
      const hb = setInterval(() => {
        controller.enqueue(encoder.encode(`: ping\n\n`));
      }, 15_000);

      const close = () => {
        clearInterval(hb);
        unsub();
        try {
          controller.close();
        } catch {
          // already closed
        }
      };

      req.signal.addEventListener("abort", close);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
