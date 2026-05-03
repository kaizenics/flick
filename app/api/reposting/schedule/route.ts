import { headers } from "next/headers";
import { rm } from "node:fs/promises";
import { auth } from "@/lib/auth";
import { extractVideoId, getVideoMeta } from "@/lib/reposting/youtube";
import { downloadVideo } from "@/lib/reposting/download";
import { generateCaption } from "@/lib/reposting/caption";
import { postVideoToFacebookPage } from "@/lib/reposting/facebook";
import { appendScheduleRecord, listScheduleRecords } from "@/lib/reposting/schedule-store";
import { readConfig } from "@/lib/reposting/config-store";

export const runtime = "nodejs";
export const maxDuration = 600;

type Item = {
  url: string;
  scheduledAt: string;
  publishNow?: boolean;
};

const MIN_LEAD_MS = 11 * 60 * 1000;
const MAX_LEAD_MS = 6 * 30 * 24 * 60 * 60 * 1000;

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) return Response.json({ error: "unauthorized" }, { status: 401 });
  const records = await listScheduleRecords();
  return Response.json({ records });
}

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    pageId?: string;
    items?: Item[];
  };
  const pageId = body.pageId?.trim();
  const items = body.items ?? [];
  if (!pageId) return Response.json({ error: "pageId required" }, { status: 400 });
  if (items.length === 0) return Response.json({ error: "no items" }, { status: 400 });

  const cfg = await readConfig();
  if (!cfg.fbPageAccessToken) {
    return Response.json(
      { error: "Facebook Page Access Token not configured — set it in Reposting → Settings" },
      { status: 500 },
    );
  }
  if (!cfg.youtubeApiKey) {
    return Response.json(
      { error: "YouTube API key not configured — set it in Reposting → Settings" },
      { status: 500 },
    );
  }
  const pageAccessToken = cfg.fbPageAccessToken;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const idx = i + 1;
        let filePath: string | null = null;
        try {
          const videoId = extractVideoId(item.url);
          if (!videoId) throw new Error(`Invalid YouTube URL: ${item.url}`);

          let scheduledTs: number | undefined;
          if (!item.publishNow) {
            const t = new Date(item.scheduledAt).getTime();
            if (Number.isNaN(t)) throw new Error(`Invalid scheduledAt: ${item.scheduledAt}`);
            const lead = t - Date.now();
            if (lead < MIN_LEAD_MS)
              throw new Error("Scheduled time must be at least 11 minutes in the future");
            if (lead > MAX_LEAD_MS)
              throw new Error("Scheduled time must be within 6 months");
            scheduledTs = Math.floor(t / 1000);
          }

          send({ idx, url: item.url, step: "metadata", message: "Fetching YouTube metadata" });
          const meta = await getVideoMeta(videoId, cfg.youtubeApiKey);

          send({ idx, url: item.url, step: "download", message: `Downloading "${meta.title}"` });
          filePath = await downloadVideo(item.url);

          send({ idx, url: item.url, step: "caption", message: "Generating caption" });
          const caption = await generateCaption({
            title: meta.title,
            description: meta.description,
            apiKey: cfg.openrouterApiKey,
            model: cfg.openrouterModel,
          });

          send({
            idx,
            url: item.url,
            step: "upload",
            message: item.publishNow ? "Uploading to Facebook" : "Uploading and scheduling on Facebook",
            caption,
          });
          const fbPostId = await postVideoToFacebookPage({
            pageId,
            pageAccessToken,
            filePath,
            description: caption,
            scheduledPublishTime: scheduledTs,
          });

          await appendScheduleRecord({
            createdAt: new Date().toISOString(),
            scheduledAt: item.publishNow ? new Date().toISOString() : item.scheduledAt,
            url: item.url,
            videoId,
            pageId,
            fbPostId,
            caption,
            status: item.publishNow ? "posted" : "scheduled",
          });

          send({
            idx,
            url: item.url,
            step: "done",
            message: item.publishNow ? `Posted (id ${fbPostId})` : `Scheduled (id ${fbPostId})`,
            fbPostId,
            caption,
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : "unknown error";
          send({ idx, url: item.url, step: "error", message: msg });
        } finally {
          if (filePath) await rm(filePath, { force: true }).catch(() => {});
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
