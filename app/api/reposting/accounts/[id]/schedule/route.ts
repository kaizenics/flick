import { getAccount } from "@/lib/reposting/accounts-store";
import { appendScheduleRecord, listScheduleRecords } from "@/lib/reposting/schedule-store";
import { runItem } from "@/lib/reposting/flows";

export const runtime = "nodejs";
export const maxDuration = 600;

type Item = {
  url: string;
  scheduledAt: string;
  publishNow?: boolean;
  caption?: string;
  comment?: string;
};

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  if (!(await getAccount(id)))
    return Response.json({ error: "not-found" }, { status: 404 });
  const records = await listScheduleRecords(id);
  return Response.json({ records });
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id: accountId } = await ctx.params;
  const account = await getAccount(accountId);
  if (!account) return Response.json({ error: "not-found" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as {
    pageId?: string;
    items?: Item[];
  };
  const fbPageId = body.pageId?.trim();
  const items = body.items ?? [];
  if (items.length === 0)
    return Response.json({ error: "no items" }, { status: 400 });
  const needsFbPage = account.flow === "yt-to-fb" || account.flow === "tt-to-fb";
  if (needsFbPage && !fbPageId)
    return Response.json({ error: "pageId required" }, { status: 400 });
  if (account.flow === "yt-to-fb") {
    const missingApprovedCaption = items.some((item) => !item.caption?.trim());
    if (missingApprovedCaption) {
      return Response.json(
        {
          error:
            "AI preflight required: each yt-to-fb queue item must have an approved caption before scheduling.",
        },
        { status: 400 },
      );
    }
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      // After Stop the client is gone and enqueue throws; swallow it so the item
      // in flight still finishes and its history record is written.
      const send = (obj: unknown) => {
        try {
          controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
        } catch {
          // client disconnected
        }
      };

      for (let i = 0; i < items.length; i++) {
        if (req.signal.aborted) {
          send({ step: "stopped", message: "Run stopped by user" });
          break;
        }
        const item = items[i];
        const idx = i + 1;
        try {
          const result = await runItem({
            accountId,
            flow: account.flow,
            url: item.url,
            scheduledAt: item.scheduledAt,
            publishNow: item.publishNow,
            fbPageId,
            manualCaption: item.caption,
            comment: item.comment,
            send: (e) => send({ idx, url: item.url, ...e }),
          });

          const nowIso = new Date().toISOString();
          await appendScheduleRecord(accountId, {
            createdAt: nowIso,
            scheduledAt: item.publishNow ? nowIso : item.scheduledAt,
            url: item.url,
            videoId: result.videoId,
            pageId: result.destinationPageId,
            fbPostId: result.postId,
            caption: result.caption,
            status: item.publishNow ? "posted" : "scheduled",
            ...(item.publishNow ? { publishedAt: nowIso } : {}),
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : "unknown error";
          send({ idx, url: item.url, step: "error", message: msg });
        }
      }
      try {
        controller.close();
      } catch {
        // client disconnected
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
