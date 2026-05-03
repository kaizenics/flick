import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getAccount } from "@/lib/reposting/accounts-store";
import { appendScheduleRecord, listScheduleRecords } from "@/lib/reposting/schedule-store";
import { runItem } from "@/lib/reposting/flows";

export const runtime = "nodejs";
export const maxDuration = 600;

type Item = {
  url: string;
  scheduledAt: string;
  publishNow?: boolean;
};

async function requireUserId(): Promise<string | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user?.id ?? null;
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  if (!(await requireUserId()))
    return Response.json({ error: "unauthorized" }, { status: 401 });
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
  if (!(await requireUserId()))
    return Response.json({ error: "unauthorized" }, { status: 401 });
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
  if (account.flow === "yt-to-fb" && !fbPageId)
    return Response.json({ error: "pageId required" }, { status: 400 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));

      for (let i = 0; i < items.length; i++) {
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
            send: (e) => send({ idx, url: item.url, ...e }),
          });

          await appendScheduleRecord(accountId, {
            createdAt: new Date().toISOString(),
            scheduledAt: item.publishNow ? new Date().toISOString() : item.scheduledAt,
            url: item.url,
            videoId: result.videoId,
            pageId: result.destinationPageId,
            fbPostId: result.postId,
            caption: result.caption,
            status: item.publishNow ? "posted" : "scheduled",
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : "unknown error";
          send({ idx, url: item.url, step: "error", message: msg });
        }
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
